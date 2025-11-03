/**
 * Test script for QuickNode filter function
 *
 * This script tests the filter.js custom filter against QuickNode's test filter endpoint.
 * It also decodes matched Drift instructions to show order details.
 *
 * Usage:
 *   bun scripts/test-filter.ts [--block <slot>] [--latest <count>] [--tx <signature>]
 *
 * Examples:
 *   bun scripts/test-filter.ts --block 123456789
 *   bun scripts/test-filter.ts --latest 10
 *   bun scripts/test-filter.ts --tx <transaction_signature>
 *
 * Environment variables (.env file):
 *   QUICKNODE_API_KEY - Your QuickNode API key (required)
 *   QUICKNODE_RPC_URL - Your QuickNode Solana RPC endpoint (optional, for latest block fetching)
 */

import { DRIFT_PROGRAM_ID, QUICKNODE_NETWORK } from "../src/const";
import { driftClient } from "../src/lib/drift";
import { QuickNodeClient } from "../src/lib/quicknode";
import { type DecodedInstruction, decodeSignedMsgOrder, isPlaceSignedMsgTakerOrder } from "../src/utils/drift-decoder";
import { getOptionalRpcUrl, getQuickNodeApiKey } from "../src/utils/env";
import { readFilterFile } from "../src/utils/file";
import { displayFormattedOrder, formatDecodedOrder } from "../src/utils/order-formatter";
import { decodeBase58, getLatestSlots, getSlotFromSignature } from "../src/utils/solana";

// Parse --latest argument with optional value
function parseLatestArg(args: string[], index: number): { value: number; skipNext: boolean } {
  const nextArg = args[index + 1];
  if (nextArg && !nextArg.startsWith("--")) {
    return { value: parseInt(nextArg, 10), skipNext: true };
  }
  return { value: 10, skipNext: false }; // Default value
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: { block?: string; latest?: number; tx?: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--block" && i + 1 < args.length) {
      parsed.block = args[i + 1];
      i++;
    } else if (args[i] === "--latest") {
      const { value, skipNext } = parseLatestArg(args, i);
      parsed.latest = value;
      if (skipNext) i++;
    } else if (args[i] === "--tx" && i + 1 < args.length) {
      parsed.tx = args[i + 1];
      i++;
    }
  }

  return parsed;
}

/**
 * Determine which blocks to test based on command line arguments
 */
async function determineBlocksToTest(
  args: { block?: string; latest?: number; tx?: string },
  rpcUrl: string | undefined,
): Promise<string[]> {
  if (args.tx) {
    if (!rpcUrl) {
      console.error("Error: QUICKNODE_RPC_URL is required when using --tx option");
      console.error("Set QUICKNODE_RPC_URL in .env file");
      process.exit(1);
    }
    console.log(`Fetching slot from transaction: ${args.tx}`);
    const slot = await getSlotFromSignature(args.tx, rpcUrl);
    console.log(`Found slot: ${slot}`);
    return [slot.toString()];
  }

  if (args.block) {
    return [args.block];
  }

  if (args.latest !== undefined) {
    if (!rpcUrl) {
      console.error("Error: QUICKNODE_RPC_URL is required when using --latest option");
      console.error("Set QUICKNODE_RPC_URL in .env file or use --block option instead");
      process.exit(1);
    }
    const count = args.latest || 10;
    console.log(`Fetching latest ${count} slots from Solana RPC...`);
    const slots = await getLatestSlots(rpcUrl, count);
    return slots.map((s) => s.toString());
  }

  // Default: test latest 10 blocks
  if (!rpcUrl) {
    console.error("Error: Either --block, --latest, or --tx option is required");
    console.error("Usage:");
    console.error("  bun scripts/test-filter.ts --block <slot>");
    console.error("  bun scripts/test-filter.ts --latest [count]");
    console.error("  bun scripts/test-filter.ts --tx <transaction_signature>");
    process.exit(1);
  }

  console.log("No options specified, fetching latest 10 slots...");
  const slots = await getLatestSlots(rpcUrl, 10);
  return slots.map((s) => s.toString());
}

/**
 * Convert QuickNode data string to Buffer
 */
function quicknodeDataToBuffer(data: string): Buffer {
  try {
    const decoded = decodeBase58(data);
    return Buffer.from(decoded);
  } catch (error) {
    console.warn(`Failed to decode as Base58: ${error}`);
    return Buffer.from(data, "base64");
  }
}

/**
 * Decode QuickNode instruction if possible
 */
function tryDecodeInstruction(ix: { data: string; programId: string }): DecodedInstruction | null {
  if (ix.programId !== DRIFT_PROGRAM_ID) {
    return null;
  }

  const ixData = quicknodeDataToBuffer(ix.data);

  if (isPlaceSignedMsgTakerOrder(ixData)) {
    try {
      const decoded = decodeSignedMsgOrder(ixData, driftClient);
      return {
        index: 0,
        programId: ix.programId,
        dataLength: ixData.length,
        type: "placeSignedMsgTakerOrder",
        decoded,
      };
    } catch (error) {
      return {
        index: 0,
        programId: ix.programId,
        dataLength: ixData.length,
        type: "placeSignedMsgTakerOrder",
        error: error instanceof Error ? error.message : "Unknown decode error",
      };
    }
  }

  return null;
}

/**
 * Display a single transaction with decoded perp orders
 */
async function displayTransaction(
  tx: { signature: string; instructions?: Array<{ data: string; programId: string }> },
  txIndex: number,
): Promise<void> {
  if (!tx.instructions || tx.instructions.length === 0) {
    return;
  }

  // Try to decode each instruction and collect perp orders
  const decodedOrders: Array<{ discriminator: string; decoded: DecodedInstruction }> = [];

  for (const ix of tx.instructions) {
    if (!ix.data || !ix.programId) continue;

    const discriminator = ix.data.substring(0, 12);
    const decoded = tryDecodeInstruction({
      data: ix.data,
      programId: ix.programId,
    });

    if (decoded?.decoded) {
      decodedOrders.push({ discriminator, decoded });
    }
  }

  // Only display if we have decoded perp orders
  if (decodedOrders.length === 0) {
    return;
  }

  console.log(`\n[Perp Order ${txIndex + 1}]`);
  console.log("=".repeat(80));

  for (const { decoded } of decodedOrders) {
    if (decoded.decoded) {
      const formatted = formatDecodedOrder(tx.signature, decoded.type, decoded.decoded);
      displayFormattedOrder(formatted);
    }
  }
}

/**
 * Display a single block with perp orders
 */
async function displayBlock(
  blockData: { transactions?: Array<{ signature: string; instructions?: Array<{ data: string; programId: string }> }> },
  slot: string,
): Promise<void> {
  if (!blockData.transactions || blockData.transactions.length === 0) {
    return;
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Slot: ${slot}`);
  console.log("=".repeat(80));

  let displayedCount = 0;
  for (const tx of blockData.transactions) {
    await displayTransaction(tx, displayedCount);
    // Count only if transaction was displayed (has decoded orders)
    if (tx.instructions && tx.instructions.length > 0) {
      const hasDecodedOrders = tx.instructions.some((ix) => {
        if (!ix.data || !ix.programId) return false;
        const decoded = tryDecodeInstruction({ data: ix.data, programId: ix.programId });
        return decoded?.decoded !== undefined;
      });
      if (hasDecodedOrders) displayedCount++;
    }
  }

  if (displayedCount === 0) {
    console.log("No decodable perp orders found in this slot");
  }
}

/**
 * Analyze and display filter result (perp orders only)
 */
async function analyzeFilterResult(
  result: Awaited<ReturnType<QuickNodeClient["testFilter"]>>,
  slot: string,
): Promise<void> {
  const filteredData = result.filtered_data || result.result;

  if (!filteredData) {
    return;
  }

  // Handle custom filter format from filter.js
  if (typeof filteredData === "object" && "matchedTransactions" in filteredData) {
    const customResult = filteredData as {
      matchedTransactions?: Array<{ signature: string; instructions?: Array<{ data: string; programId: string }> }>;
    };
    if (customResult.matchedTransactions && customResult.matchedTransactions.length > 0) {
      await displayBlock({ transactions: customResult.matchedTransactions }, slot);
    }
    return;
  }

  // Handle standard array format
  if (Array.isArray(filteredData)) {
    for (const block of filteredData) {
      // Convert to our expected format
      const blockData = block as unknown as {
        transactions?: Array<{ signature: string; instructions?: Array<{ data: string; programId: string }> }>;
      };
      await displayBlock(blockData, slot);
    }
  }
}

/**
 * Test a single block
 */
async function testSingleBlock(
  client: QuickNodeClient,
  network: string,
  block: string,
  filterFunction: string,
): Promise<TestResult> {
  try {
    const result = await client.testFilter(network, block, filterFunction);
    await analyzeFilterResult(result, block);

    return {
      block,
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n✗ Slot ${block} failed: ${errorMessage}`);
    return {
      block,
      result: null,
      error: errorMessage,
    };
  }
}

/**
 * Display test summary
 */
function displaySummary(results: TestResult[], blocksToTest: string[]): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log("Summary");
  console.log("=".repeat(80));
  console.log(`Total slots tested: ${blocksToTest.length}`);
  console.log(`Successful: ${results.filter((r) => !r.error).length}`);
  console.log(`Failed: ${results.filter((r) => r.error).length}`);

  if (results.some((r) => r.error)) {
    console.log("\nFailed slots:");
    results
      .filter((r) => r.error)
      .forEach((r) => {
        console.log(`  - Slot ${r.block}: ${r.error}`);
      });
  }
}

interface TestResult {
  block: string;
  result: Awaited<ReturnType<QuickNodeClient["testFilter"]>> | null;
  error?: string;
}

async function testFilter(): Promise<void> {
  // Load environment variables
  // Bun automatically loads .env file
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getOptionalRpcUrl();
  if (!rpcUrl && !process.argv.includes("--block")) {
    console.warn("Warning: QUICKNODE_RPC_URL not set. Cannot fetch latest blocks without --block option.");
    console.warn("Set QUICKNODE_RPC_URL in .env file or use --block option to specify a block.");
  }

  // Initialize Drift client for decoding
  console.log("Initializing Drift client...");
  await driftClient.subscribe();

  // Parse command line arguments
  const args = parseArgs();
  const network = QUICKNODE_NETWORK;

  // Initialize QuickNode client
  const client = new QuickNodeClient({ apiKey });

  // Read filter function from file
  const filterFilePath = process.env.FILTER_FILE || "src/filter.js";
  console.log(`Reading filter function from: ${filterFilePath}`);
  const filterFunction = await readFilterFile(filterFilePath);
  console.log(`Filter function loaded (${filterFunction.length} characters)`);
  console.log("");

  // Determine which blocks to test
  const blocksToTest = await determineBlocksToTest(args, rpcUrl);

  console.log(`\n${"=".repeat(80)}`);
  console.log("Testing Drift Perp Orders");
  console.log("=".repeat(80));

  if (args.tx) {
    console.log(`Transaction: ${args.tx}`);
    console.log(`Slot: ${blocksToTest[0]}`);
  } else if (args.block) {
    console.log(`Slot: ${args.block}`);
  } else {
    console.log(`Slots: ${blocksToTest.join(", ")}`);
  }
  console.log(`Network: ${network}\n`);

  // Test each block
  const results: TestResult[] = [];
  for (const block of blocksToTest) {
    const result = await testSingleBlock(client, network, block, filterFunction);
    results.push(result);
  }

  // Display summary
  displaySummary(results, blocksToTest);
}

// Run the test
testFilter()
  .catch((error) => {
    console.error("Fatal error:", error);
  })
  .finally(() => {
    process.exit(1);
  });
