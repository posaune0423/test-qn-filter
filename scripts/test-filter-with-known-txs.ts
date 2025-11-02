/**
 * Test filter.js with known Drift transactions
 *
 * This script tests the filter against known transactions to verify
 * that discriminators are correctly identified.
 */

import { QuickNodeClient } from "../src/lib/quicknode";
import { readFilterFile } from "../src/utils/file";
import {
  TEST_TRANSACTIONS,
  getSlotFromSignature,
  getReadyTestTransactions,
  isTestTransactionReady
} from "./tools/test-transactions";

async function testFilterWithKnownTransactions(): Promise<void> {
  const apiKey = process.env.QUICKNODE_API_KEY;
  if (!apiKey) {
    console.error("Error: QUICKNODE_API_KEY environment variable is required");
    console.error("Please set it in .env file");
    process.exit(1);
  }

  const rpcUrl = process.env.QUICKNODE_RPC_URL || process.env.RPC_URL;
  if (!rpcUrl) {
    console.error("Error: QUICKNODE_RPC_URL or RPC_URL environment variable is required");
    console.error("Please set it in .env file");
    process.exit(1);
  }

  console.log("=".repeat(80));
  console.log("Testing filter.js with known Drift transactions");
  console.log("=".repeat(80));
  console.log("");

  const client = new QuickNodeClient({ apiKey });
  const filterFunction = await readFilterFile("src/filter.js");
  const network = "solana-mainnet";

  let passCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  const allTransactions = Object.entries(TEST_TRANSACTIONS);
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
    console.log(`  Signature: ${txInfo.signature}`);
    console.log(`  Discriminator: ${txInfo.discriminator}`);
    console.log(`  Expected: ${txInfo.shouldMatch ? "MATCH" : "NO MATCH"}`);

    try {
      // Get slot for this transaction
      const slot = await getSlotFromSignature(txInfo.signature, rpcUrl);
      console.log(`  Slot: ${slot}`);

      // Test filter
      const result = await client.testFilter(network, slot.toString(), filterFunction);
      const filteredData = result.filtered_data || result.result;

      // Check if transaction was matched
      let matched = false;
      if (filteredData?.matchedTransactions && Array.isArray(filteredData.matchedTransactions)) {
        matched = filteredData.matchedTransactions.some(
          (tx: any) => tx.signature === txInfo.signature
        );
      }

      // Verify result
      const passed = matched === txInfo.shouldMatch;

      if (passed) {
        console.log(`  ✓ PASS: Filter ${matched ? "matched" : "did not match"} as expected`);
        passCount++;
      } else {
        console.log(`  ✗ FAIL: Filter ${matched ? "matched" : "did not match"} but expected ${txInfo.shouldMatch ? "match" : "no match"}`);
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
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(80));
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
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
  })