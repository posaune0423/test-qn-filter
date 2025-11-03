import { DRIFT_PROGRAM_ID, QUICKNODE_NETWORK, TEST_TRANSACTIONS } from "../src/const";
import { driftClient } from "../src/lib/drift";
import { QuickNodeClient } from "../src/lib/quicknode";
import { type DecodedInstruction, decodeSignedMsgOrder, isPlaceSignedMsgTakerOrder } from "../src/utils/drift-decoder";
import { getQuickNodeApiKey, getRpcUrl } from "../src/utils/env";
import { displayFormattedOrder, formatDecodedOrder } from "../src/utils/order-formatter";
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
 * Decode QuickNode instruction
 */
function decodeQuickNodeInstruction(
  ix: { data: string; accounts: string[]; programId: string },
  index: number,
): DecodedInstruction {
  // Check if it's a Drift instruction
  if (ix.programId !== DRIFT_PROGRAM_ID) {
    return {
      index,
      programId: ix.programId,
      dataLength: 0,
      type: "unknown",
      error: "Not a Drift instruction",
    };
  }

  // Convert QuickNode Base58 data to Buffer
  const ixData = quicknodeDataToBuffer(ix.data);

  // Check if it's a placeSignedMsgTakerOrder instruction
  if (isPlaceSignedMsgTakerOrder(ixData)) {
    try {
      const decoded = decodeSignedMsgOrder(ixData, driftClient);
      return {
        index,
        programId: ix.programId,
        dataLength: ixData.length,
        type: "placeSignedMsgTakerOrder",
        decoded,
      };
    } catch (error) {
      return {
        index,
        programId: ix.programId,
        dataLength: ixData.length,
        type: "placeSignedMsgTakerOrder",
        error: error instanceof Error ? error.message : "Unknown decode error",
      };
    }
  }

  return {
    index,
    programId: ix.programId,
    dataLength: ixData.length,
    type: "unknown",
  };
}

async function main() {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();
  const targetSignature = TEST_TRANSACTIONS.placeSignedMsgTakerOrder.signature;

  console.log("=".repeat(80));
  console.log("QuickNode Test Filter - Transaction Decode");
  console.log("=".repeat(80));
  console.log(`\nTarget signature: ${targetSignature}`);

  // Subscribe to Drift client
  console.log("\nInitializing Drift client...");
  await driftClient.subscribe();

  // Get slot from signature
  console.log("Fetching slot from signature...");
  const slot = await getSlotFromSignature(targetSignature, rpcUrl);
  console.log(`Slot: ${slot}`);

  // Create filter function
  const filterFunction = createTransactionFilter(targetSignature);

  // Call QuickNode test-filter API
  console.log("\nCalling QuickNode test-filter API...");
  const client = new QuickNodeClient({ apiKey });
  const result = await client.testFilter(QUICKNODE_NETWORK, slot.toString(), filterFunction);

  console.log(`\n${"=".repeat(80)}`);
  console.log("QuickNode API Response - Raw Instructions");
  console.log("=".repeat(80));

  // Extract instructions from result
  const resultData = result.result as unknown;
  if (!resultData || typeof resultData !== "object" || !("transaction" in resultData)) {
    console.log("No transaction data found in result");
    return;
  }

  const customResult = resultData as {
    transaction?: { message?: { instructions?: Array<{ data: string; accounts: string[]; programId: string }> } };
    slot?: number;
    blockTime?: number;
  };

  const instructions = customResult.transaction?.message?.instructions;
  if (!instructions || instructions.length === 0) {
    console.log("No instructions found");
    return;
  }

  console.log(`Found ${instructions.length} instructions\n`);

  // Decode each instruction
  console.log("=".repeat(80));
  console.log("Decoded Drift Instructions");
  console.log("=".repeat(80));

  const decodedInstructions: DecodedInstruction[] = [];
  for (const [index, ix] of instructions.entries()) {
    const decoded = decodeQuickNodeInstruction(ix, index);
    // Only include Drift instructions
    if (decoded.type !== "unknown" || decoded.error !== "Not a Drift instruction") {
      decodedInstructions.push(decoded);
    }
  }

  if (decodedInstructions.length === 0) {
    console.log("No Drift instructions found");
    return;
  }

  // Display decoded results
  console.log(`\n${"=".repeat(80)}`);
  console.log("Decoded Perp Orders");
  console.log("=".repeat(80));

  for (const decoded of decodedInstructions) {
    if (decoded.decoded) {
      const formatted = formatDecodedOrder(targetSignature, decoded.type, decoded.decoded);
      console.log("");
      displayFormattedOrder(formatted);
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
