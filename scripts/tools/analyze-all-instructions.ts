/**
 * Analyze ALL instructions including inner instructions (CPIs)
 */

import { Connection, PublicKey } from "@solana/web3.js";

const DRIFT_PROGRAM_ID = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

async function analyzeAllInstructions(signature: string, rpcUrl: string) {
  const connection = new Connection(rpcUrl, "confirmed");

  console.log(`\nAnalyzing: ${signature}`);
  console.log("=".repeat(80));

  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    console.error("Transaction not found");
    return;
  }

  const message = tx.transaction.message;
  const accountKeys = message.staticAccountKeys;

  console.log("\n📋 Top-level instructions:");
  console.log("=".repeat(80));

  message.compiledInstructions.forEach((ix, idx) => {
    const programId = accountKeys[ix.programIdIndex];
    const data = Buffer.from(ix.data);

    console.log(`\nInstruction #${idx}:`);
    console.log(`  Program: ${programId.toBase58()}`);
    console.log(`  Data length: ${data.length} bytes`);

    if (programId.equals(DRIFT_PROGRAM_ID) && data.length >= 8) {
      const disc = data.slice(0, 8);
      const first12 = disc.toString('base64').substring(0, 12);
      console.log(`  ✅ DRIFT INSTRUCTION`);
      console.log(`  Discriminator (full):  ${disc.toString('base64')}`);
      console.log(`  Discriminator (12chr): ${first12}`);
      console.log(`  Discriminator (hex):   0x${disc.toString('hex')}`);
    }
  });

  console.log("\n\n📦 Inner instructions (CPIs):");
  console.log("=".repeat(80));

  if (tx.meta?.innerInstructions) {
    tx.meta.innerInstructions.forEach(inner => {
      console.log(`\n🔗 Inner instructions for top-level instruction #${inner.index}:`);

      inner.instructions.forEach((ix, idx) => {
        const programId = accountKeys[ix.programIdIndex];
        const data = Buffer.from(ix.data);

        console.log(`\n  Inner #${idx}:`);
        console.log(`    Program: ${programId.toBase58()}`);
        console.log(`    Data length: ${data.length} bytes`);

        if (programId.equals(DRIFT_PROGRAM_ID) && data.length >= 8) {
          const disc = data.slice(0, 8);
          const first12 = disc.toString('base64').substring(0, 12);
          console.log(`    ✅ DRIFT CPI`);
          console.log(`    Discriminator (full):  ${disc.toString('base64')}`);
          console.log(`    Discriminator (12chr): ${first12}`);
          console.log(`    Discriminator (hex):   0x${disc.toString('hex')}`);
        }
      });
    });
  } else {
    console.log("No inner instructions");
  }

  console.log("\n\n📝 Program logs:");
  console.log("=".repeat(80));
  if (tx.meta?.logMessages) {
    tx.meta.logMessages.forEach(log => {
      if (log.includes("Instruction:") || log.includes("invoke")) {
        console.log(log);
      }
    });
  }
}

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.QUICKNODE_RPC_URL;

  if (!rpcUrl) {
    console.error("Error: RPC_URL or QUICKNODE_RPC_URL required");
    process.exit(1);
  }

  const sig = "2EfEUs1ieBCWxBXnTakkH9cdTH6DbBzyTJte9uxjuGmZJ2Teza2jwBH7T4EgtNXUQyPRnDYfZSgyj8nXTjtoex28";
  await analyzeAllInstructions(sig, rpcUrl);
}

if (import.meta.main) {
  main().catch(console.error);
}
