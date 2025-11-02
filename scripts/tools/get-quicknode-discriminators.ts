/**
 * Get QuickNode format discriminators for all test transactions
 */

import { DRIFT_PROGRAM_ID, QUICKNODE_NETWORK, TEST_TRANSACTIONS } from "../../src/const";
import { QuickNodeClient } from "../../src/lib/quicknode";
import { getQuickNodeApiKey, getRpcUrl } from "../../src/utils/env";
import { getSlotFromSignature } from "../../src/utils/solana";

async function getQuickNodeDiscriminators() {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();

  const client = new QuickNodeClient({ apiKey });
  const network = QUICKNODE_NETWORK;

  // Create a debug filter that finds our transaction and logs its discriminator
  const debugFilter = `
    const DRIFT_PROGRAM_ID = '${DRIFT_PROGRAM_ID}';

    function main(stream) {
      const data = stream.data[0];
      if (!data?.transactions) return null;

      const TARGET_SIG = '__TARGET_SIG__';

      for (const tx of data.transactions) {
        const sig = tx.transaction?.signatures?.[0];
        if (sig === TARGET_SIG) {
          const instructions = tx.transaction?.message?.instructions || [];
          for (const ix of instructions) {
            if (ix.programId === DRIFT_PROGRAM_ID && ix.data) {
              return {
                found: true,
                signature: sig,
                discriminator: ix.data.substring(0, 12),
                fullData: ix.data
              };
            }
          }
        }
      }
      return { found: false };
    }
  `;

  console.log("=".repeat(80));
  console.log("Getting QuickNode format discriminators");
  console.log("=".repeat(80));
  console.log("");

  for (const [name, txInfo] of Object.entries(TEST_TRANSACTIONS)) {
    console.log(`\n${name}:`);
    console.log(`  Signature: ${txInfo.signature.substring(0, 20)}...`);

    try {
      const slot = await getSlotFromSignature(txInfo.signature, rpcUrl);
      console.log(`  Slot: ${slot}`);

      const filter = debugFilter.replace("__TARGET_SIG__", txInfo.signature);
      const testResult = await client.testFilter(network, slot.toString(), filter);

      // Debug filter returns custom shape: { found: boolean, signature?, discriminator?, fullData? } | null
      // Handle both array (FilteredBlock[]) and direct object responses
      const rawData = testResult.filtered_data || testResult.result;
      const filteredData = Array.isArray(rawData) ? rawData[0] : rawData;

      // Type guard for debug filter response - treat as unknown first to allow proper narrowing
      const debugResult = filteredData as unknown;
      if (
        debugResult &&
        typeof debugResult === "object" &&
        "found" in debugResult &&
        debugResult.found === true &&
        "discriminator" in debugResult &&
        typeof debugResult.discriminator === "string"
      ) {
        const matchResult = debugResult as { found: true; signature: string; discriminator: string; fullData: string };
        console.log(`  ✅ QuickNode discriminator: ${matchResult.discriminator}`);
        console.log(`  RPC discriminator:        ${txInfo.discriminator}`);
        console.log(`  Match: ${matchResult.discriminator === txInfo.discriminator ? "✅" : "❌"}`);
      } else {
        console.log(`  ❌ Transaction not found in block`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

if (import.meta.main) {
  getQuickNodeDiscriminators().catch(console.error);
}
