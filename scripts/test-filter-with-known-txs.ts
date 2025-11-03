/**
 * Test filter.js with known Drift transactions
 *
 * This script tests the filter against known transactions to verify
 * that discriminators are correctly identified and decoded properly.
 */

import { DRIFT_PROGRAM_ID, QUICKNODE_NETWORK, TEST_TRANSACTIONS } from "../src/const";
import { driftClient } from "../src/lib/drift";
import { QuickNodeClient } from "../src/lib/quicknode";
import type { TestTransaction } from "../src/types";
import { type DecodedInstruction, decodeSignedMsgOrder, isPlaceSignedMsgTakerOrder } from "../src/utils/drift-decoder";
import { getQuickNodeApiKey, getRpcUrl } from "../src/utils/env";
import { readFilterFile } from "../src/utils/file";
import { displayFormattedOrder, formatDecodedOrder } from "../src/utils/order-formatter";
import { decodeBase58, getSlotFromSignature } from "../src/utils/solana";

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
 * Check if transaction was matched in filtered data
 */
function checkIfMatched(filteredData: unknown, signature: string): boolean {
  if (!filteredData || typeof filteredData !== "object") {
    return false;
  }

  // Check if it's the custom format from filter.js
  if ("matchedTransactions" in filteredData) {
    const customResult = filteredData as {
      matchedTransactions?: Array<{ signature: string }>;
    };
    const matchedTransactions = customResult.matchedTransactions || [];
    return matchedTransactions.some((tx) => tx.signature === signature);
  }

  // Check if it's an array of blocks
  if (Array.isArray(filteredData)) {
    return filteredData.some((block) =>
      block.transactions?.some((tx: { signature: string }) => tx.signature === signature),
    );
  }

  return false;
}

/**
 * Get matched transaction from filtered data
 */
function getMatchedTransaction(
  filteredData: unknown,
  signature: string,
): { instructions?: Array<{ data: string; programId: string }> } | null {
  if (!filteredData || typeof filteredData !== "object") {
    return null;
  }

  // Check if it's the custom format from filter.js
  if ("matchedTransactions" in filteredData) {
    const customResult = filteredData as {
      matchedTransactions?: Array<{
        signature: string;
        instructions?: Array<{ data: string; programId: string }>;
      }>;
    };
    const matchedTransactions = customResult.matchedTransactions || [];
    return matchedTransactions.find((tx) => tx.signature === signature) || null;
  }

  return null;
}

async function testFilterWithKnownTransactions(): Promise<void> {
  const apiKey = getQuickNodeApiKey();
  const rpcUrl = getRpcUrl();

  console.log("=".repeat(80));
  console.log("Testing filter.js with known Drift transactions");
  console.log("=".repeat(80));
  console.log("");

  // Initialize Drift client
  console.log("Initializing Drift client...");
  await driftClient.subscribe();

  const client = new QuickNodeClient({ apiKey });
  const filterFunction = await readFilterFile("src/filter.js");
  const network = QUICKNODE_NETWORK;

  let passCount = 0;
  let failCount = 0;

  const allTransactions = Object.entries(TEST_TRANSACTIONS) as Array<[string, TestTransaction]>;

  console.log(`Total test transactions: ${allTransactions.length}\n`);

  for (const [instructionName, txInfo] of allTransactions) {
    try {
      // Get slot for this transaction
      const slot = await getSlotFromSignature(txInfo.signature, rpcUrl);

      // Test filter
      const result = await client.testFilter(network, slot.toString(), filterFunction);
      const filteredData = result.filtered_data || result.result;

      // Check if transaction was matched
      const matched = checkIfMatched(filteredData, txInfo.signature);
      const matchedTx = getMatchedTransaction(filteredData, txInfo.signature);

      // Verify result
      const passed = matched === txInfo.shouldMatch;

      if (passed) {
        passCount++;

        // Show decoded perp orders if available
        if (matched && matchedTx?.instructions) {
          console.log(`\n${"=".repeat(80)}`);
          console.log(`${instructionName}`);
          console.log("=".repeat(80));

          for (const ix of matchedTx.instructions) {
            const decoded = tryDecodeInstruction(ix);
            if (decoded?.decoded) {
              const formatted = formatDecodedOrder(txInfo.signature, instructionName, decoded.decoded);
              displayFormattedOrder(formatted);
            } else {
              // For non-decodable instructions, show basic info
              console.log(`tx: https://solscan.io/tx/${txInfo.signature}`);
              console.log(`method: ${instructionName}`);
              console.log(`discriminator: ${ix.data.substring(0, 12)}`);
              console.log(`(Unable to decode order parameters)`);
            }
          }
        }
      } else {
        console.log(`\n✗ FAIL: ${instructionName}`);
        console.log(`  Expected: ${txInfo.shouldMatch ? "match" : "no match"}`);
        console.log(`  Got: ${matched ? "match" : "no match"}`);
        failCount++;
      }
    } catch (error) {
      console.log(`\n✗ ERROR: ${instructionName}`);
      console.log(`  ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("Test Summary");
  console.log("=".repeat(80));
  console.log(`Total: ${allTransactions.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
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
