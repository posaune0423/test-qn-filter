import { QUICKNODE_NETWORK, TEST_TRANSACTIONS } from "../src/const";
import { driftClient } from "../src/lib/drift";
import { QuickNodeClient } from "../src/lib/quicknode";
import { getQuickNodeApiKey, getRpcUrl } from "../src/utils/env";
import { decodeBase58, getSlotFromSignature } from "../src/utils/solana";

/**
 * Create a filter function that returns a specific transaction by signature
 */
function createTransactionFilter(targetSignature: string): string {
  return `
function main(stream) {
  try {
    const data = stream.data[0];
    if (!data?.transactions) {
      return null;
    }

    const TARGET_SIG = '${targetSignature}';

    // Find the target transaction
    for (const tx of data.transactions) {
      const sig = tx.transaction?.signatures?.[0];
      if (sig === TARGET_SIG) {
        // Return the entire transaction object
        return {
          signature: sig,
          transaction: tx.transaction,
          meta: tx.meta,
          slot: data.slot,
          blockTime: data.blockTime,
        };
      }
    }

    return null;
  } catch (error) {
    return { error: error.message || String(error) };
  }
}
  `.trim();
}

/**
 * Convert QuickNode data string to Buffer
 * QuickNode uses Base58 encoding for instruction data
 * @see https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data
 */
function quicknodeDataToBuffer(data: string): Buffer {
  try {
    // QuickNode uses Base58 encoding for instruction data
    const decoded = decodeBase58(data);
    return Buffer.from(decoded);
  } catch (error) {
    console.warn(`Failed to decode as Base58: ${error}`);
    // Fallback to base64 (for backwards compatibility)
    try {
      return Buffer.from(data, "base64");
    } catch {
      return Buffer.from(data, "utf-8");
    }
  }
}

/**
 * Convert Buffer to hex string for comparison
 */
function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

/**
 * Compare instruction data between QuickNode and RPC formats
 */
function compareInstructionData(quicknodeData: string, rpcData: Buffer, instructionIndex: number): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Instruction ${instructionIndex} Data Comparison`);
  console.log("=".repeat(80));

  // Decode QuickNode data
  const qnBuffer = quicknodeDataToBuffer(quicknodeData);
  const qnHex = bufferToHex(qnBuffer);

  // RPC data
  const rpcHex = bufferToHex(rpcData);

  console.log(`\nQuickNode (string):`);
  console.log(`  Length: ${quicknodeData.length} chars`);
  console.log(`  Raw string: ${quicknodeData.substring(0, 50)}...`);
  console.log(`  Encoding: Base58 (as per QuickNode documentation)`);
  console.log(`  Decoded Buffer length: ${qnBuffer.length} bytes`);
  console.log(`  Hex: ${qnHex.substring(0, 100)}...`);
  console.log(
    `  First few bytes: ${Array.from(qnBuffer.slice(0, 10))
      .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
      .join(" ")}`,
  );

  console.log(`\nRPC (Buffer):`);
  console.log(`  Length: ${rpcData.length} bytes`);
  console.log(`  Hex: ${rpcHex.substring(0, 100)}...`);
  console.log(
    `  First few bytes: ${Array.from(rpcData.slice(0, 10))
      .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
      .join(" ")}`,
  );

  console.log(`\nComparison:`);
  console.log(`  Lengths match: ${qnBuffer.length === rpcData.length ? "✅" : "❌"}`);
  console.log(`  Data matches: ${qnHex === rpcHex ? "✅" : "❌"}`);

  if (qnHex !== rpcHex) {
    console.log(`\n⚠️  Data mismatch detected!`);
    const minLength = Math.min(qnBuffer.length, rpcData.length);
    for (let i = 0; i < Math.min(minLength, 50); i++) {
      const qnByte = qnBuffer[i];
      const rpcByte = rpcData[i];
      if (qnByte !== undefined && rpcByte !== undefined && qnByte !== rpcByte) {
        console.log(`  First difference at byte ${i}:`);
        console.log(`    QuickNode: 0x${qnByte.toString(16).padStart(2, "0")} (${qnByte})`);
        console.log(`    RPC:       0x${rpcByte.toString(16).padStart(2, "0")} (${rpcByte})`);
        break;
      }
    }
  }
}

/**
 * Fetch and extract instructions from both sources
 */
async function fetchInstructions(
  targetSignature: string,
  slot: number,
  apiKey: string,
): Promise<{
  qnInstructions: Array<{ data: string; accounts: string[]; programId: string }>;
  rpcInstructions: Array<{ data: Uint8Array | Buffer; accountKeyIndexes: number[] }>;
}> {
  // Fetch from QuickNode
  console.log("\nFetching from QuickNode test-filter API...");
  const filterFunction = createTransactionFilter(targetSignature);
  const client = new QuickNodeClient({ apiKey });
  const qnResult = await client.testFilter(QUICKNODE_NETWORK, slot.toString(), filterFunction);

  // Fetch from RPC
  console.log("Fetching from RPC...");
  driftClient.subscribe();
  const rpcTx = await driftClient.connection.getTransaction(targetSignature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!rpcTx) {
    throw new Error("Failed to fetch transaction from RPC");
  }

  // Extract QuickNode instructions
  const resultData = qnResult.result as unknown;
  if (!resultData || typeof resultData !== "object" || !("transaction" in resultData)) {
    throw new Error("Failed to fetch transaction from QuickNode");
  }

  const customResult = resultData as {
    transaction?: { message?: { instructions?: Array<{ data: string; accounts: string[]; programId: string }> } };
  };
  const qnInstructions = customResult.transaction?.message?.instructions;
  const rpcInstructions = rpcTx.transaction.message.compiledInstructions;

  if (!qnInstructions || !rpcInstructions) {
    throw new Error("Failed to extract instructions");
  }

  return { qnInstructions, rpcInstructions };
}

async function main() {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();
  const targetSignature = TEST_TRANSACTIONS.placeSignedMsgTakerOrder.signature;

  console.log("=".repeat(80));
  console.log("Comparing QuickNode vs RPC Instruction Formats");
  console.log("=".repeat(80));
  console.log(`\nTarget signature: ${targetSignature}`);

  // Get slot from signature
  console.log("\nFetching slot from signature...");
  const slot = await getSlotFromSignature(targetSignature, rpcUrl);
  console.log(`Slot: ${slot}`);

  const { qnInstructions, rpcInstructions } = await fetchInstructions(targetSignature, slot, apiKey);

  console.log(`\n${"=".repeat(80)}`);
  console.log("Summary");
  console.log("=".repeat(80));
  console.log(`QuickNode instructions: ${qnInstructions.length}`);
  console.log(`RPC compiledInstructions: ${rpcInstructions.length}`);

  // Compare each instruction
  const minLength = Math.min(qnInstructions.length, rpcInstructions.length);
  for (let i = 0; i < minLength; i++) {
    const qnIx = qnInstructions[i];
    const rpcIx = rpcInstructions[i];

    if (!qnIx || !rpcIx) {
      continue;
    }

    if (!qnIx.data || !rpcIx.data) {
      continue;
    }

    // Convert RPC data to Buffer if it's Uint8Array
    const rpcDataBuffer = Buffer.isBuffer(rpcIx.data) ? rpcIx.data : Buffer.from(rpcIx.data);

    // Compare data
    compareInstructionData(qnIx.data, rpcDataBuffer, i);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("Analysis Complete");
  console.log("=".repeat(80));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
