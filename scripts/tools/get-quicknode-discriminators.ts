/**
 * Get QuickNode format discriminators for all test transactions
 */

import { QuickNodeClient } from "../../src/lib/quicknode";
import { readFilterFile } from "../../src/utils/file";
import { TEST_TRANSACTIONS, getSlotFromSignature } from "./test-transactions";

async function getQuickNodeDiscriminators() {
  const apiKey = process.env.QUICKNODE_API_KEY;
  if (!apiKey) {
    console.error("Error: QUICKNODE_API_KEY required");
    process.exit(1);
  }

  const rpcUrl = process.env.RPC_URL || process.env.QUICKNODE_RPC_URL;
  if (!rpcUrl) {
    console.error("Error: RPC_URL or QUICKNODE_RPC_URL required");
    process.exit(1);
  }

  const client = new QuickNodeClient({ apiKey });
  const network = "solana-mainnet";

  // Create a debug filter that finds our transaction and logs its discriminator
  const debugFilter = `
    const DRIFT_PROGRAM_ID = 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH';

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

      const filter = debugFilter.replace('__TARGET_SIG__', txInfo.signature);
      const result = await client.testFilter(network, slot.toString(), filter);

      const filteredData = result.filtered_data || result.result;

      if (filteredData?.found) {
        console.log(`  ✅ QuickNode discriminator: ${filteredData.discriminator}`);
        console.log(`  RPC discriminator:        ${txInfo.discriminator}`);
        console.log(`  Match: ${filteredData.discriminator === txInfo.discriminator ? '✅' : '❌'}`);
      } else {
        console.log(`  ❌ Transaction not found in block`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

if (import.meta.main) {
  getQuickNodeDiscriminators().catch(console.error);
}
