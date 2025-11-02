import { QUICKNODE_NETWORK, TEST_TRANSACTIONS } from "../src/const";
import { QuickNodeClient } from "../src/lib/quicknode";
import { getQuickNodeApiKey, getRpcUrl } from "../src/utils/env";
import { getSlotFromSignature } from "../src/utils/solana";

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

async function main() {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();
  const targetSignature = TEST_TRANSACTIONS.placeSignedMsgTakerOrder.signature;

  console.log("=".repeat(80));
  console.log("QuickNode Test Filter - Transaction Data");
  console.log("=".repeat(80));
  console.log(`\nTarget signature: ${targetSignature}`);

  // Get slot from signature
  console.log("\nFetching slot from signature...");
  const slot = await getSlotFromSignature(targetSignature, rpcUrl);
  console.log(`Slot: ${slot}`);

  // Create filter function
  const filterFunction = createTransactionFilter(targetSignature);
  console.log("\nFilter function:");
  console.log("-".repeat(80));
  console.log(filterFunction);
  console.log("-".repeat(80));

  // Call QuickNode test-filter API
  console.log("\nCalling QuickNode test-filter API...");
  const client = new QuickNodeClient({ apiKey });
  const result = await client.testFilter(QUICKNODE_NETWORK, slot.toString(), filterFunction);

  console.log(`\n${"=".repeat(80)}`);
  console.log("QuickNode API Response - transaction.message.instructions");
  console.log("=".repeat(80));
  // result.result can be FilteredBlock[] or the custom filter return value
  const resultData = result.result as unknown;
  if (resultData && typeof resultData === "object" && "transaction" in resultData) {
    const customResult = resultData as { transaction?: { message?: { instructions?: unknown } } };
    console.dir(customResult.transaction?.message?.instructions, { depth: null });
  } else {
    console.log("No transaction data found in result");
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
