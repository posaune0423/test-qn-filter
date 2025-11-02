/**
 * Compare instruction discriminators from two RPC endpoints
 *
 * This script fetches the same transaction from two different RPC endpoints
 * (RPC_URL and QUICKNODE_RPC_URL) and compares the discriminators of instructions.
 *
 * Usage:
 *   bun scripts/compare-discriminators.ts [transaction_signature|test_name]
 *
 * Examples:
 *   bun scripts/compare-discriminators.ts
 *     # Runs all known test transactions from TEST_TRANSACTIONS
 *
 *   bun scripts/compare-discriminators.ts placePerpOrder
 *     # Runs specific test transaction by name
 *
 *   bun scripts/compare-discriminators.ts 2XZEL1VY8d8ZRgLsjMNAMLDGPt5oPBy1nz9ho2ZZXcLWwmjrscNhRjipX45WiEh7NGKKktabfoCq5dWGGn2DwYvS
 *     # Runs specific transaction by signature
 *
 * Environment variables (.env file):
 *   RPC_URL - Helius RPC endpoint URL (required)
 *   QUICKNODE_RPC_URL - QuickNode RPC endpoint URL (required)
 */

import { Connection } from "@solana/web3.js";
import { TEST_TRANSACTIONS } from "../src/const";

interface InstructionDiscriminator {
  index: number;
  programId: string;
  discriminatorBase64: string;
  discriminatorHex: string;
  discriminatorFirst12: string;
  dataLength: number;
}

/**
 * Extract discriminators from a transaction
 */
async function extractDiscriminators(connection: Connection, signature: string): Promise<InstructionDiscriminator[]> {
  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx) {
    throw new Error(`Transaction not found: ${signature}`);
  }

  const discriminators: InstructionDiscriminator[] = [];
  const message = tx.transaction.message;

  if ("compiledInstructions" in message) {
    const accountKeys = message.staticAccountKeys;

    for (let i = 0; i < message.compiledInstructions.length; i++) {
      const ix = message.compiledInstructions[i];
      if (!ix) continue;

      const programId = accountKeys[ix.programIdIndex];
      if (!programId) continue;

      const data = Buffer.from(ix.data);
      if (!data || data.length < 8) continue;

      const discriminator = data.slice(0, 8);
      const discriminatorBase64 = discriminator.toString("base64");
      const discriminatorHex = discriminator.toString("hex");
      const discriminatorFirst12 = discriminatorBase64.substring(0, 12);

      discriminators.push({
        index: i,
        programId: programId.toBase58(),
        discriminatorBase64,
        discriminatorHex: `0x${discriminatorHex}`,
        discriminatorFirst12,
        dataLength: data.length,
      });
    }
  }

  return discriminators;
}

/**
 * Log instruction details when it's missing from one endpoint
 */
function logMissingInstruction(
  disc: InstructionDiscriminator,
  presentLabel: string,
  missingLabel: string,
): void {
  console.log(`   ┌─ Present in ${presentLabel}`);
  console.log(`   │  Program:     ${disc.programId}`);
  console.log(`   │  Base64:      ${disc.discriminatorBase64}`);
  console.log(`   │  Hex:         ${disc.discriminatorHex}`);
  console.log(`   │  First 12:    ${disc.discriminatorFirst12}`);
  console.log(`   └─ ❌ Missing in ${missingLabel}`);
}

/**
 * Compare and log a single instruction pair
 */
function compareInstructionPair(
  disc1: InstructionDiscriminator,
  disc2: InstructionDiscriminator,
  label1: string,
  label2: string,
): boolean {
  const programMatch = disc1.programId === disc2.programId;
  const discriminatorMatch = disc1.discriminatorBase64 === disc2.discriminatorBase64;
  let differencesFound = false;

  console.log(`   ├─ Program ID:     ${disc1.programId}`);
  console.log(`   ├─ Data length:   ${disc1.dataLength} bytes`);

  if (!programMatch) {
    console.log(`   ├─ ⚠️  Program ID MISMATCH:`);
    console.log(`   │     ${label1}: ${disc1.programId}`);
    console.log(`   │     ${label2}: ${disc2.programId}`);
    differencesFound = true;
  }

  if (!discriminatorMatch) {
    console.log(`   ├─ ❌ Discriminator MISMATCH:`);
    console.log(`   │     ${label1}: ${disc1.discriminatorBase64}`);
    console.log(`   │     ${label2}: ${disc2.discriminatorBase64}`);
    console.log(`   │     Hex:`);
    console.log(`   │       ${label1}: ${disc1.discriminatorHex}`);
    console.log(`   │       ${label2}: ${disc2.discriminatorHex}`);
    console.log(`   │     First 12 chars:`);
    console.log(`   │       ${label1}: ${disc1.discriminatorFirst12}`);
    console.log(`   │       ${label2}: ${disc2.discriminatorFirst12}`);
    differencesFound = true;
  } else {
    console.log(`   └─ ✅ Discriminator match: ${disc1.discriminatorBase64}`);
  }

  return differencesFound;
}

/**
 * Print header section
 */
function printHeader(signature: string): void {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  Discriminator Comparison Report`);
  console.log(`${"═".repeat(80)}`);
  console.log(`  Transaction: ${signature}`);
  console.log(`  View on Solscan: https://solscan.io/tx/${signature}`);
  console.log(`${"─".repeat(80)}`);
}

/**
 * Print configuration section
 */
function printConfiguration(label1: string, rpcUrl1: string, label2: string, rpcUrl2: string): void {
  console.log(`\n📋 Configuration:`);
  console.log(`  ${label1}:`);
  console.log(`    ${rpcUrl1}`);
  console.log(`  ${label2}:`);
  console.log(`    ${rpcUrl2}`);
}

/**
 * Fetch discriminators from both RPC endpoints
 */
async function fetchDiscriminators(
  signature: string,
  rpcUrl1: string,
  rpcUrl2: string,
  label1: string,
  label2: string,
): Promise<[InstructionDiscriminator[], InstructionDiscriminator[]]> {
  console.log(`\n📥 Fetching transaction data...`);
  console.log(`  → Fetching from ${label1}...`);
  const connection1 = new Connection(rpcUrl1, "confirmed");
  const discriminators1 = await extractDiscriminators(connection1, signature);
  console.log(`  ✓ Found ${discriminators1.length} instruction(s)`);

  console.log(`  → Fetching from ${label2}...`);
  const connection2 = new Connection(rpcUrl2, "confirmed");
  const discriminators2 = await extractDiscriminators(connection2, signature);
  console.log(`  ✓ Found ${discriminators2.length} instruction(s)`);

  return [discriminators1, discriminators2];
}

/**
 * Print statistics section
 */
function printStatistics(
  discriminators1: InstructionDiscriminator[],
  discriminators2: InstructionDiscriminator[],
  label1: string,
  label2: string,
): void {
  console.log(`\n${"─".repeat(80)}`);
  console.log(`📊 Statistics:`);
  console.log(`  ${label1}: ${discriminators1.length} instruction(s)`);
  console.log(`  ${label2}: ${discriminators2.length} instruction(s)`);

  const countMatch = discriminators1.length === discriminators2.length;
  if (!countMatch) {
    console.log(`  ⚠️  Instruction count mismatch detected!`);
  } else {
    console.log(`  ✅ Instruction count matches`);
  }
}

interface ComparisonResult {
  differencesFound: boolean;
  matchCount: number;
  mismatchCount: number;
  missingCount: number;
}

/**
 * Compare all instructions
 */
function compareInstructions(
  discriminators1: InstructionDiscriminator[],
  discriminators2: InstructionDiscriminator[],
  label1: string,
  label2: string,
): ComparisonResult {
  const maxLength = Math.max(discriminators1.length, discriminators2.length);
  let differencesFound = false;
  let matchCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  if (maxLength === 0) {
    return { differencesFound: false, matchCount: 0, mismatchCount: 0, missingCount: 0 };
  }

  console.log(`\n${"─".repeat(80)}`);
  console.log(`🔍 Instruction Comparison:`);
  console.log(`${"─".repeat(80)}`);

  for (let i = 0; i < maxLength; i++) {
    const disc1 = discriminators1[i];
    const disc2 = discriminators2[i];

    console.log(`\nInstruction #${i}:`);

    if (!disc1 && disc2) {
      console.log(`   ┌─ ❌ Missing in ${label1}`);
      console.log(`   └─ ✅ Present in ${label2}:`);
      console.log(`      Program:     ${disc2.programId}`);
      console.log(`      Base64:      ${disc2.discriminatorBase64}`);
      console.log(`      Hex:         ${disc2.discriminatorHex}`);
      console.log(`      First 12:    ${disc2.discriminatorFirst12}`);
      differencesFound = true;
      missingCount++;
      continue;
    }

    if (disc1 && !disc2) {
      logMissingInstruction(disc1, label1, label2);
      differencesFound = true;
      missingCount++;
      continue;
    }

    if (!disc1 || !disc2) {
      continue;
    }

    // Both exist, compare them
    const hasDifference = compareInstructionPair(disc1, disc2, label1, label2);
    if (hasDifference) {
      differencesFound = true;
      mismatchCount++;
    } else {
      matchCount++;
    }
  }

  return { differencesFound, matchCount, mismatchCount, missingCount };
}

/**
 * Print summary section
 */
function printSummary(
  result: ComparisonResult,
  maxLength: number,
  label1: string,
  label2: string,
): void {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`📝 Summary:`);
  console.log(`${"═".repeat(80)}`);
  console.log(`  Total instructions compared: ${maxLength}`);
  console.log(`  ✅ Matches:     ${result.matchCount}`);
  console.log(`  ❌ Mismatches:  ${result.mismatchCount}`);
  console.log(`  ⚠️  Missing:    ${result.missingCount}`);

  if (result.differencesFound) {
    console.log(`\n  ❌ Differences found between RPC endpoints`);
    console.log(`  ⚠️  The discriminators from ${label1} and ${label2} are not identical.`);
  } else {
    console.log(`\n  ✅ All discriminators match perfectly!`);
    console.log(`  ✓ No differences found between ${label1} and ${label2}.`);
  }
  console.log(`${"═".repeat(80)}\n`);
}

/**
 * Compare discriminators from two RPC endpoints
 */
async function compareDiscriminators(
  signature: string,
  rpcUrl1: string,
  rpcUrl2: string,
  label1: string,
  label2: string,
): Promise<void> {
  printHeader(signature);
  printConfiguration(label1, rpcUrl1, label2, rpcUrl2);

  const [discriminators1, discriminators2] = await fetchDiscriminators(signature, rpcUrl1, rpcUrl2, label1, label2);
  printStatistics(discriminators1, discriminators2, label1, label2);

  const result = compareInstructions(discriminators1, discriminators2, label1, label2);
  const maxLength = Math.max(discriminators1.length, discriminators2.length);
  printSummary(result, maxLength, label1, label2);
}

/**
 * Print overall summary for multiple transactions
 */
function printOverallSummary(
  results: Array<{ name: string; signature: string; success: boolean; error?: string }>,
): void {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`📊 Overall Summary`);
  console.log(`${"═".repeat(80)}`);
  console.log(`  Total transactions tested: ${results.length}`);
  console.log(`  ✅ Successful: ${results.filter((r) => r.success).length}`);
  console.log(`  ❌ Failed: ${results.filter((r) => !r.success).length}`);

  if (results.some((r) => !r.success)) {
    console.log(`\n  Failed transactions:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`    - ${r.name} (${r.signature.substring(0, 20)}...): ${r.error}`);
      });
  }
  console.log(`${"═".repeat(80)}\n`);
}

/**
 * Get transaction signature from argument or TEST_TRANSACTIONS
 */
function getTransactionSignatures(arg: string | undefined): Array<{ name: string; signature: string; description: string }> {
  if (!arg) {
    // No argument: return all test transactions
    return Object.entries(TEST_TRANSACTIONS).map(([name, tx]) => ({
      name,
      signature: tx.signature,
      description: tx.description,
    }));
  }

  // Check if argument is a test transaction name
  if (arg in TEST_TRANSACTIONS) {
    const tx = TEST_TRANSACTIONS[arg as keyof typeof TEST_TRANSACTIONS];
    return [
      {
        name: arg,
        signature: tx.signature,
        description: tx.description,
      },
    ];
  }

  // Otherwise, treat as signature
  return [
    {
      name: "custom",
      signature: arg,
      description: "Custom transaction",
    },
  ];
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const arg = process.argv[2];
  const transactions = getTransactionSignatures(arg);

  const rpcUrl = process.env.RPC_URL;
  const quicknodeRpcUrl = process.env.QUICKNODE_RPC_URL;

  if (!rpcUrl) {
    console.error("Error: RPC_URL environment variable is required");
    console.error("Set RPC_URL in .env file");
    process.exit(1);
  }

  if (!quicknodeRpcUrl) {
    console.error("Error: QUICKNODE_RPC_URL environment variable is required");
    console.error("Set QUICKNODE_RPC_URL in .env file");
    process.exit(1);
  }

  const results: Array<{ name: string; signature: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (!tx) continue;

    const isLast = i === transactions.length - 1;

    // Print transaction info header
    if (transactions.length > 1) {
      console.log(`\n${"╔".repeat(40)}`);
      console.log(`  Test ${i + 1}/${transactions.length}: ${tx.name}`);
      console.log(`  Description: ${tx.description}`);
      console.log(`${"╚".repeat(40)}`);
    }

    try {
      await compareDiscriminators(
        tx.signature,
        rpcUrl,
        quicknodeRpcUrl,
        "Helius (RPC_URL)",
        "QuickNode (QUICKNODE_RPC_URL)",
      );
      results.push({ name: tx.name, signature: tx.signature, success: true });

      // Add separator between transactions (except last)
      if (!isLast && transactions.length > 1) {
        console.log(`\n${"─".repeat(80)}\n`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Error processing ${tx.name}:`, errorMessage);
      results.push({ name: tx.name, signature: tx.signature, success: false, error: errorMessage });
    }
  }

  // Print overall summary if multiple transactions were tested
  if (transactions.length > 1) {
    printOverallSummary(results);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
