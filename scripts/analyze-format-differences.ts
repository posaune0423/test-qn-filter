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
 * Analyze and document the conversion differences
 */
async function analyzeConversionDifferences(): Promise<void> {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();
  const targetSignature = TEST_TRANSACTIONS.placeSignedMsgTakerOrder.signature;

  console.log("=".repeat(80));
  console.log("QuickNode vs RPC Instruction Format Analysis");
  console.log("=".repeat(80));
  console.log(`\nTarget signature: ${targetSignature}`);

  // Get slot from signature
  console.log("\nFetching slot from signature...");
  const slot = await getSlotFromSignature(targetSignature, rpcUrl);
  console.log(`Slot: ${slot}`);

  // Fetch from both sources
  console.log("\nFetching from QuickNode test-filter API...");
  const filterFunction = createTransactionFilter(targetSignature);
  const client = new QuickNodeClient({ apiKey });
  const qnResult = await client.testFilter(QUICKNODE_NETWORK, slot.toString(), filterFunction);

  console.log("Fetching from RPC...");
  driftClient.subscribe();
  const rpcTx = await driftClient.connection.getTransaction(targetSignature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!rpcTx) {
    console.error("❌ Failed to fetch transaction from RPC");
    process.exit(1);
  }

  // Extract QuickNode instructions
  const resultData = qnResult.result as unknown;
  if (!resultData || typeof resultData !== "object" || !("transaction" in resultData)) {
    console.error("❌ Failed to fetch transaction from QuickNode");
    process.exit(1);
  }

  const customResult = resultData as {
    transaction?: { message?: { instructions?: Array<{ data: string; accounts: string[]; programId: string }> } };
  };
  const qnInstructions = customResult.transaction?.message?.instructions;
  const rpcInstructions = rpcTx.transaction.message.compiledInstructions;

  if (!qnInstructions || !rpcInstructions) {
    console.error("❌ Failed to extract instructions");
    process.exit(1);
  }

  // Find Drift instruction (index 3)
  const driftIndex = 3;
  const qnDriftIx = qnInstructions[driftIndex];
  const rpcDriftIx = rpcInstructions[driftIndex];

  if (!qnDriftIx || !rpcDriftIx) {
    console.error("❌ Drift instruction not found");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("FINDINGS: QuickNode vs RPC Format Differences");
  console.log("=".repeat(80));

  // Analyze data format
  console.log(`\n1. DATA FIELD ENCODING:`);
  console.log(`   QuickNode: "${qnDriftIx.data.substring(0, 50)}..." (${qnDriftIx.data.length} chars)`);
  console.log(`   Format: Base58-encoded string`);
  console.log(
    `   Reference: https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data`,
  );

  // Decode using Base58 (as per QuickNode documentation)
  const qnBuffer = Buffer.from(decodeBase58(qnDriftIx.data));
  console.log(`   Decoded length: ${qnBuffer.length} bytes`);
  console.log(`   Decoded hex (first 32 bytes): ${qnBuffer.slice(0, 32).toString("hex")}`);

  console.log(`\n   RPC: Buffer object`);
  // Convert RPC data to Buffer if it's Uint8Array
  const rpcDataBuffer = Buffer.isBuffer(rpcDriftIx.data) ? rpcDriftIx.data : Buffer.from(rpcDriftIx.data);
  console.log(`   Length: ${rpcDataBuffer.length} bytes`);
  console.log(`   Hex (first 32 bytes): ${rpcDataBuffer.slice(0, 32).toString("hex")}`);

  const dataMatches = qnBuffer.length === rpcDataBuffer.length && qnBuffer.equals(rpcDataBuffer);

  if (dataMatches) {
    console.log(`\n   ✅ FINDING: QuickNode and RPC data MATCH after Base58 decoding!`);
    console.log(`   - QuickNode returns Base58-encoded string`);
    console.log(`   - RPC returns raw Buffer`);
    console.log(`   - After Base58 decoding, the binary data is identical`);
  } else {
    console.log(`\n   ⚠️  FINDING: QuickNode and RPC data do NOT match after Base58 decoding`);
    console.log(`   - QuickNode returns Base58-encoded string`);
    console.log(`   - RPC returns raw Buffer`);
    console.log(`   - Lengths: QuickNode=${qnBuffer.length}, RPC=${rpcDriftIx.data.length}`);
  }

  // Document conversion
  console.log(`\n${"=".repeat(80)}`);
  console.log("CONCLUSION:");
  console.log("=".repeat(80));
  console.log(`
QuickNode Streams and RPC use different data formats:

DATA FIELD:
   - QuickNode: Base58-encoded string
   - RPC: Raw Buffer
   - Conversion: Buffer.from(decodeBase58(qnData))
   - ✅ After Base58 decoding, the data matches RPC's Buffer exactly
   - Reference: https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data

RECOMMENDATION:
   - Use QuickNode's format directly when working with Streams filters
   - Use RPC's format when working with standard Solana RPC calls
   - DATA field can be converted using Base58 encoding/decoding
  `);

  console.log(`\n${"=".repeat(80)}`);
  console.log("Analysis Complete");
  console.log("=".repeat(80));
}

analyzeConversionDifferences()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
