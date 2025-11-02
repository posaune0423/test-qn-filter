/**
 * Test filter.js with known Drift transactions
 *
 * This script tests the filter against known transactions to verify
 * that discriminators are correctly identified.
 */

import { QUICKNODE_NETWORK, TEST_TRANSACTIONS } from "../src/const";
import { QuickNodeClient } from "../src/lib/quicknode";
import type { TestTransaction } from "../src/types";
import { getQuickNodeApiKey, getRpcUrl } from "../src/utils/env";
import { readFilterFile } from "../src/utils/file";
import { getSlotFromSignature } from "../src/utils/solana";
import { getReadyTestTransactions, isTestTransactionReady } from "./tools/test-transactions";

async function testFilterWithKnownTransactions(): Promise<void> {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();

  console.log("=".repeat(80));
  console.log("Testing filter.js with known Drift transactions");
  console.log("=".repeat(80));
  console.log("");

  const client = new QuickNodeClient({ apiKey });
  const filterFunction = await readFilterFile("src/filter.js");
  const network = QUICKNODE_NETWORK;

  let passCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  const allTransactions = Object.entries(TEST_TRANSACTIONS) as Array<[string, TestTransaction]>;
  const readyTransactions = Object.entries(getReadyTestTransactions());

  console.log(`Total test transactions: ${allTransactions.length}`);
  console.log(`Ready for testing: ${readyTransactions.length}`);
  console.log(`Skipped (TODO): ${allTransactions.length - readyTransactions.length}`);
  console.log("");

  for (const [instructionName, txInfo] of allTransactions) {
    // Skip transactions that are not ready
    if (!isTestTransactionReady(txInfo)) {
      console.log(`\n⊘ Skipping: ${instructionName} (TODO: Add real transaction)`);
      skippedCount++;
      continue;
    }
    console.log(`\nTesting: ${instructionName}`);
    console.log(`  Description: ${txInfo.description}`);
    console.log(`  Signature: https://solscan.io/tx/${txInfo.signature}`);
    console.log(`  Discriminator (RPC):       ${txInfo.discriminator}`);
    console.log(`  Discriminator (QuickNode): ${txInfo.quicknodeDiscriminator || "N/A"}`);
    console.log(`  Expected: ${txInfo.shouldMatch ? "MATCH" : "NO MATCH"}`);

    try {
      // Get slot for this transaction
      const slot = await getSlotFromSignature(txInfo.signature, rpcUrl);
      console.log(`  Slot: ${slot}`);

      // Test filter
      const result = await client.testFilter(network, slot.toString(), filterFunction);
      const filteredData = result.filtered_data || result.result;

      // Check if transaction was matched
      let matched: boolean = false;
      if (filteredData && Array.isArray(filteredData)) {
        matched = filteredData.some((block) =>
          block.transactions.some((tx) => tx.signature === txInfo.signature),
        );
      }

      // Verify result
      const passed = matched === txInfo.shouldMatch;

      if (passed) {
        const matchStatus = matched === true ? "matched" : "did not match";
        console.log(`  ✓ PASS: Filter ${matchStatus} as expected`);
        passCount++;
      } else {
        const matchStatus = matched === true ? "matched" : "did not match";
        const expectedStatus = txInfo.shouldMatch ? "match" : "no match";
        console.log(`  ✗ FAIL: Filter ${matchStatus} but expected ${expectedStatus}`);
        failCount++;

        // Show debug info on failure
        if (filteredData) {
          console.log(`  Debug: Filtered data:`, JSON.stringify(filteredData, null, 2));
        }
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("Test Summary");
  console.log("=".repeat(80));
  console.log(`Total transactions: ${allTransactions.length}`);
  console.log(`Tested: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log("");

  if (failCount === 0) {
    console.log("✓ All tests passed!");
  } else {
    console.log("✗ Some tests failed. Please review the discriminators in filter.js");
    process.exit(1);
  }
}

// Run tests
testFilterWithKnownTransactions()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
