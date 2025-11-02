/**
 * Find Drift perp transactions from recent blocks
 *
 * This script helps find real Drift perp transactions to use as test cases.
 * It scans recent blocks and identifies transactions with Drift instructions.
 *
 * Usage:
 *   bun scripts/tools/find-drift-transactions.ts [--blocks <count>]
 *
 * Example:
 *   bun scripts/tools/find-drift-transactions.ts --blocks 100
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { DRIFT_PROGRAM_ID } from "../../src/const";
import { getOptionalRpcUrl } from "../../src/utils/env";

const DRIFT_PROGRAM_ID_PK = new PublicKey(DRIFT_PROGRAM_ID);

interface DriftTransaction {
  signature: string;
  slot: number;
  discriminator: string;
  discriminatorHex: string;
  instructionName?: string;
}

/**
 * Extract discriminator from instruction data
 */
function extractDiscriminator(data: Buffer): { base64: string; hex: string; first12: string } {
  const discriminator = data.slice(0, 8);
  const base64Full = discriminator.toString("base64");
  const first12 = base64Full.substring(0, 12);
  const hex = discriminator.toString("hex");

  return {
    base64: base64Full,
    hex,
    first12,
  };
}

/**
 * Known discriminators for Drift perp instructions
 */
const KNOWN_DISCRIMINATORS: Record<string, string> = {
  Pe62ShZLxbSn: "placePerpOrder",
  // Add more as they are discovered
};

/**
 * Scan a single block for Drift transactions
 */
async function scanBlock(connection: Connection, slot: number): Promise<DriftTransaction[]> {
  try {
    const block = await connection.getBlock(slot, {
      maxSupportedTransactionVersion: 0,
      transactionDetails: "full",
    });

    if (!block?.transactions) {
      return [];
    }

    const driftTransactions: DriftTransaction[] = [];

    for (const tx of block.transactions) {
      const message = tx.transaction.message;

      // Check versioned transaction
      if ("compiledInstructions" in message) {
        const accountKeys = message.staticAccountKeys;

        for (const ix of message.compiledInstructions) {
          const programId = accountKeys[ix.programIdIndex];

          if (!programId) continue;

          if (programId.equals(DRIFT_PROGRAM_ID_PK)) {
            const data = Buffer.from(ix.data);
            const disc = extractDiscriminator(data);
            const signature = tx.transaction.signatures[0];

            driftTransactions.push({
              signature: signature || "",
              slot,
              discriminator: disc.first12,
              discriminatorHex: `0x${disc.hex}`,
              instructionName: KNOWN_DISCRIMINATORS[disc.first12] || "unknown",
            });
          }
        }
      }
    }

    return driftTransactions;
  } catch (error) {
    console.error(`Error scanning block ${slot}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * Main function
 */
async function findDriftTransactions(): Promise<void> {
  const rpcUrl = getOptionalRpcUrl();

  if (!rpcUrl) {
    console.error("Error: RPC_URL or QUICKNODE_RPC_URL environment variable is required");
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  let blockCount = 50; // Default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--blocks" && i + 1 < args.length) {
      blockCount = parseInt(args[i + 1] || "50", 10);
      i++;
    }
  }

  console.log("=".repeat(80));
  console.log("Finding Drift Perp Transactions");
  console.log("=".repeat(80));
  console.log(`Scanning last ${blockCount} blocks...`);
  console.log("");

  const connection = new Connection(rpcUrl, "confirmed");
  const latestSlot = await connection.getSlot();

  console.log(`Latest slot: ${latestSlot}`);
  console.log(`Scanning slots: ${latestSlot - blockCount + 1} to ${latestSlot}`);
  console.log("");

  const allTransactions: DriftTransaction[] = [];
  const discriminatorCounts = new Map<string, number>();

  for (let i = 0; i < blockCount; i++) {
    const slot = latestSlot - i;
    process.stdout.write(`\rScanning block ${i + 1}/${blockCount} (slot: ${slot})...`);

    const transactions = await scanBlock(connection, slot);
    allTransactions.push(...transactions);

    // Count discriminators
    for (const tx of transactions) {
      const count = discriminatorCounts.get(tx.discriminator) || 0;
      discriminatorCounts.set(tx.discriminator, count + 1);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n");
  console.log("=".repeat(80));
  console.log("Results");
  console.log("=".repeat(80));
  console.log(`Total Drift transactions found: ${allTransactions.length}`);
  console.log("");

  // Group by discriminator
  console.log("Transactions by instruction type:");
  console.log("");

  const groupedByDiscriminator = new Map<string, DriftTransaction[]>();
  for (const tx of allTransactions) {
    const group = groupedByDiscriminator.get(tx.discriminator) || [];
    group.push(tx);
    groupedByDiscriminator.set(tx.discriminator, group);
  }

  for (const [discriminator, transactions] of groupedByDiscriminator.entries()) {
    const instructionName = transactions[0]?.instructionName || "unknown";
    console.log(`${instructionName} (${discriminator}):`);
    console.log(`  Count: ${transactions.length}`);
    console.log(`  Example signatures:`);

    // Show up to 3 example signatures
    for (let i = 0; i < Math.min(3, transactions.length); i++) {
      console.log(`    ${transactions[i]?.signature || ""}`);
    }
    console.log("");
  }

  // Show unknown discriminators
  const unknownTransactions = allTransactions.filter((tx) => tx.instructionName === "unknown");
  if (unknownTransactions.length > 0) {
    console.log("=".repeat(80));
    console.log("Unknown Discriminators (add to KNOWN_DISCRIMINATORS)");
    console.log("=".repeat(80));

    const uniqueUnknown = new Map<string, DriftTransaction>();
    for (const tx of unknownTransactions) {
      if (!uniqueUnknown.has(tx.discriminator)) {
        uniqueUnknown.set(tx.discriminator, tx);
      }
    }

    for (const [discriminator, tx] of uniqueUnknown.entries()) {
      console.log(`Discriminator: ${discriminator} (${tx.discriminatorHex})`);
      console.log(`  Example: ${tx.signature}`);
      console.log(`  Verify: bun scripts/tools/verify-discriminators.ts ${tx.signature}`);
      console.log("");
    }
  }

  console.log("=".repeat(80));
  console.log("Next Steps");
  console.log("=".repeat(80));
  console.log("1. Pick example signatures for each instruction type");
  console.log("2. Verify discriminators:");
  console.log("   bun scripts/tools/verify-discriminators.ts <signature> <instructionName>");
  console.log("3. Add to scripts/tools/test-transactions.ts");
  console.log("4. Update src/filter.js with new discriminators");
}

// Run if executed directly
if (import.meta.main) {
  findDriftTransactions().catch(console.error);
}
