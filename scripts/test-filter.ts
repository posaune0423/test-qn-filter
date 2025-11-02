/**
 * Test script for QuickNode filter function
 *
 * This script tests the filter.js custom filter against QuickNode's test filter endpoint.
 *
 * Usage:
 *   bun scripts/test-filter.ts [--block <slot>] [--latest <count>]
 *
 * Examples:
 *   bun scripts/test-filter.ts --block 123456789
 *   bun scripts/test-filter.ts --latest 10
 *   bun scripts/test-filter.ts --latest 5  # Default is 10 if not specified
 *
 * Environment variables (.env file):
 *   QUICKNODE_API_KEY - Your QuickNode API key (required)
 *   QUICKNODE_RPC_URL - Your QuickNode Solana RPC endpoint (optional, for latest block fetching)
 */

// removed: node:path (no longer needed)
import { Connection } from "@solana/web3.js";
import { type FilteredBlock, type FilteredTransaction, QuickNodeClient } from "../src/lib/quicknode";
import { readFilterFile } from "../src/utils/file";

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

// Get latest slots from Solana RPC
async function getLatestSlots(rpcUrl: string, count: number): Promise<number[]> {
  const connection = new Connection(rpcUrl, "confirmed");
  const latestSlot = await connection.getSlot();
  const slots: number[] = [];

  // Get slots from latest backwards
  for (let i = 0; i < count; i++) {
    slots.push(latestSlot - i);
  }

  return slots;
}

/**
 * Get slot from transaction signature
 */
async function getSlotFromTransaction(txSignature: string, rpcUrl: string): Promise<number> {
  const connection = new Connection(rpcUrl, "confirmed");
  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error(`Transaction not found: ${txSignature}`);
  }

  if (!tx.slot) {
    throw new Error(`Transaction slot not found: ${txSignature}`);
  }

  return tx.slot;
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
    const slot = await getSlotFromTransaction(args.tx, rpcUrl);
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
 * Format instruction name for display
 */
function _formatInstructionName(ix: any): string {
  if (ix.instructionName && ix.instructionName !== "unknown") return ix.instructionName;
  const disc = ix.discriminator;
  if (disc && disc.length >= 11) {
    try {
      const hex = Buffer.from(`${disc}=`, "base64").toString("hex").substring(0, 16);
      return `Unknown(0x${hex})`;
    } catch (_e) {
      return `Unknown(${disc})`;
    }
  }
  return "Unknown";
}

/**
 * Format authority address for display
 */
// removed: _formatAuthority (not used)

/**
 * Get simple instruction info for display
 */
// Removed: getSimpleInstructionInfo (unused after simplifying display)

/**
 * Display a single instruction (simple format)
 */
// Removed: _displayInstruction (unused)

/**
 * Generate discriminator mapping (same logic as build-filter.ts)
 */
// Removed: local discriminator map generation and lookup — rely on names from filter.js

/**
 * Extract method names from logs
 */
function _extractMethodFromLogs(logs: string[]): string | null {
  for (const log of logs) {
    const match = log.match(/Instruction:\s+(\w+)/);
    if (match?.[1] && match[1] !== "PostPythLazerOracleUpdate") {
      return match[1];
    }
  }
  return null;
}

/**
 * Display a single transaction
 */
async function displayTransaction(tx: FilteredTransaction, txIndex: number): Promise<void> {
  console.log(`\n    [Tx ${txIndex + 1}]`);
  console.log(`    Tx: https://solscan.io/tx/${tx.signature}`);
  console.log(`    Status: ${tx.success ? "✓ Success" : "✗ Failed"} | Fee: ${tx.fee} lamports`);

  // Display signer from first instruction
  if (tx.instructions && tx.instructions.length > 0) {
    const firstIx = tx.instructions[0];
    if (firstIx?.authority) {
      console.log(`    Signer: ${firstIx?.authority.substring(0, 8)}...`);
    }

    // Get all method names from instructions (use filter-provided name, fallback to logs)
    let methods = tx.instructions.map((ix) => _formatInstructionName(ix));
    if (methods.every((m) => m === "Unknown") && tx.logs && tx.logs.length > 0) {
      const fromLogs = _extractMethodFromLogs(tx.logs);
      if (fromLogs) methods = [fromLogs];
    }
    const filteredMethods = methods.filter((m) => m !== "PostPythLazerOracleUpdate");

    if (filteredMethods.length > 0) {
      if (filteredMethods.length === 1) {
        console.log(`    Method: ${filteredMethods[0]}`);
      } else {
        console.log(`    Methods:`);
        filteredMethods.forEach((method, idx) => {
          console.log(`      [${idx + 1}] ${method}`);
        });
      }
    }

    // Show instruction count
    console.log(`    Instructions: ${tx.instructions.length}`);
  }

  console.log("");
}

/**
 * Display a single block
 */
async function displayBlock(blockData: FilteredBlock | any, index: number): Promise<void> {
  console.log(`  Block ${index + 1} (Slot: ${blockData.block?.slot}):`);
  if (blockData.transactions) {
    console.log(`    ${blockData.transactions.length} Drift transaction(s)\n`);
    for (const tx of blockData.transactions) {
      await displayTransaction(tx, blockData.transactions.indexOf(tx));
    }
  }
}

/**
 * Analyze and display filter result
 */
async function analyzeFilterResult(result: Awaited<ReturnType<QuickNodeClient["testFilter"]>>): Promise<void> {
  if (result.logs && result.logs.length > 0) {
    console.log("  Filter function logs:");
    result.logs.forEach((log: string) => {
      console.log(`    ${log}`);
    });
  }

  const filteredData = result.filtered_data || result.result;

  if (!filteredData) {
    console.log("  No matches found");
    return;
  }

  if (Array.isArray(filteredData)) {
    console.log(`\n  ✓ Found ${filteredData.length} matching block(s)\n`);
    for (let index = 0; index < filteredData.length; index++) {
      await displayBlock(filteredData[index], index);
    }
  } else {
    console.log(`  Filtered data: ${JSON.stringify(filteredData, null, 2)}`);
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
    console.log(`\n[${block}] Calling QuickNode test filter endpoint...`);
    const result = await client.testFilter(network, block, filterFunction);

    console.log(`✓ Block ${block} completed successfully`);
    await analyzeFilterResult(result);

    return {
      block,
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✗ Block ${block} failed: ${errorMessage}`);
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
  console.log(`\n${"=".repeat(60)}`);
  console.log("Summary:");
  console.log(`  Total blocks tested: ${blocksToTest.length}`);
  console.log(`  Successful: ${results.filter((r) => !r.error).length}`);
  console.log(`  Failed: ${results.filter((r) => r.error).length}`);

  const blocksWithMatches = results.filter(
    (r) =>
      !r.error &&
      r.result?.filtered_data &&
      (Array.isArray(r.result.filtered_data) ? r.result.filtered_data.length > 0 : true),
  ).length;

  console.log(`  Blocks with matches: ${blocksWithMatches}`);

  if (results.some((r) => r.error)) {
    console.log("\nFailed blocks:");
    results
      .filter((r) => r.error)
      .forEach((r) => {
        console.log(`  - Block ${r.block}: ${r.error}`);
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
  const apiKey = process.env.QUICKNODE_API_KEY;
  if (!apiKey) {
    console.error("Error: QUICKNODE_API_KEY environment variable is required");
    console.error("Please set it in .env file: QUICKNODE_API_KEY=your_api_key");
    process.exit(1);
  }

  const rpcUrl = process.env.QUICKNODE_RPC_URL || process.env.RPC_URL || undefined;
  if (!rpcUrl && !process.argv.includes("--block")) {
    console.warn("Warning: QUICKNODE_RPC_URL not set. Cannot fetch latest blocks without --block option.");
    console.warn("Set QUICKNODE_RPC_URL in .env file or use --block option to specify a block.");
  }

  // Parse command line arguments
  const args = parseArgs();
  const network = "solana-mainnet";

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
  if (args.tx) {
    console.log(`Testing transaction: ${args.tx}`);
    console.log(`Testing slot: ${blocksToTest[0]}`);
  } else if (args.block) {
    console.log(`Testing specific block: ${args.block}`);
  } else {
    console.log(`Testing slots: ${blocksToTest.join(", ")}`);
  }

  console.log(`Network: ${network}`);
  console.log("");

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
