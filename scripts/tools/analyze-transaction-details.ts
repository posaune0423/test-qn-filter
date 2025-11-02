/**
 * Analyze transaction details to understand instruction structure
 */

import { Connection, PublicKey } from "@solana/web3.js";

const DRIFT_PROGRAM_ID = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");

async function analyzeTransaction(signature: string, rpcUrl: string) {
  const connection = new Connection(rpcUrl, "confirmed");

  console.log(`\nAnalyzing transaction: ${signature}`);
  console.log("=".repeat(80));

  const tx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx) {
    console.error("Transaction not found");
    return;
  }

  console.log(`Slot: ${tx.slot}`);
  console.log(`Block Time: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'N/A'}`);
  console.log(`Success: ${!tx.meta?.err}`);
  console.log("");

  const message = tx.transaction.message;

  // Find all Drift instructions
  let driftInstructionIndex = 0;
  let totalInstructionIndex = 0;

  if ('compiledInstructions' in message) {
    const accountKeys = message.staticAccountKeys;

    console.log(`Total instructions in transaction: ${message.compiledInstructions.length}`);
    console.log("");

    for (const ix of message.compiledInstructions) {
      const programId = accountKeys[ix.programIdIndex];

      if (programId.equals(DRIFT_PROGRAM_ID)) {
        const data = Buffer.from(ix.data);
        const discriminator = data.slice(0, 8);
        const first12Chars = discriminator.toString("base64").substring(0, 12);

        console.log(`Drift Instruction #${driftInstructionIndex} (overall instruction #${totalInstructionIndex}):`);
        console.log(`  Discriminator (base64 full): ${discriminator.toString("base64")}`);
        console.log(`  Discriminator (first 12):    ${first12Chars}`);
        console.log(`  Discriminator (hex):         0x${discriminator.toString("hex")}`);
        console.log(`  Full data length:            ${data.length} bytes`);
        console.log(`  Accounts count:              ${ix.accountKeyIndexes.length}`);
        console.log(`  First 32 bytes (hex):        ${data.slice(0, 32).toString("hex")}`);
        console.log("");

        driftInstructionIndex++;
      }
      totalInstructionIndex++;
    }

    console.log(`Total Drift instructions found: ${driftInstructionIndex}`);
    console.log("");
  }

  // Check logs for instruction name
  if (tx.meta?.logMessages) {
    console.log("Relevant logs:");
    for (const log of tx.meta.logMessages) {
      if (log.includes("Instruction:") || log.includes("invoke")) {
        console.log(`  ${log}`);
      }
    }
  }
}

async function main() {
  const rpcUrl = process.env.RPC_URL || process.env.QUICKNODE_RPC_URL;

  if (!rpcUrl) {
    console.error("Error: RPC_URL or QUICKNODE_RPC_URL required");
    process.exit(1);
  }

  const signatures = [
    {
      sig: "2XZEL1VY8d8ZRgLsjMNAMLDGPt5oPBy1nz9ho2ZZXcLWwmjrscNhRjipX45WiEh7NGKKktabfoCq5dWGGn2DwYvS",
      name: "placeSignedMsgTakerOrder"
    },
    {
      sig: "2EfEUs1ieBCWxBXnTakkH9cdTH6DbBzyTJte9uxjuGmZJ2Teza2jwBH7T4EgtNXUQyPRnDYfZSgyj8nXTjtoex28",
      name: "placeAndMakeSignedMsgPerpOrder"
    }
  ];

  for (const { sig, name } of signatures) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Expected: ${name}`);
    await analyzeTransaction(sig, rpcUrl);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
