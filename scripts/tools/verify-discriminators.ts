/**
 * Verify Drift instruction discriminators from actual transactions
 *
 * This script fetches actual Drift transactions and extracts the discriminators
 * to verify the correct values for filtering.
 */

import { Connection, PublicKey } from "@solana/web3.js";

const DRIFT_PROGRAM_ID = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH";

interface DiscriminatorInfo {
  instructionName: string;
  txHash: string;
  discriminatorBase64: string;
  discriminatorHex: string;
  accountsCount: number;
}

async function extractDiscriminator(
  connection: Connection,
  signature: string,
  instructionName: string,
): Promise<DiscriminatorInfo | null> {
  try {
    console.log(`\nFetching transaction: ${signature}`);
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      console.error(`  ✗ Transaction not found: ${signature}`);
      return null;
    }

    const driftProgramId = new PublicKey(DRIFT_PROGRAM_ID);
    const message = tx.transaction.message;

    let driftInstruction: { data: Uint8Array; accountsCount: number } | null = null;

    if ('compiledInstructions' in message) {
      const accountKeys = message.staticAccountKeys;
      for (const ix of message.compiledInstructions) {
        const programId = accountKeys[ix.programIdIndex];
        if (programId && programId.equals(driftProgramId)) {
          driftInstruction = {
            data: ix.data,
            accountsCount: ix.accountKeyIndexes.length,
          };
          break;
        }
      }
    } else {
      // Legacy message format
      const legacyMessage = message as any;
      if (legacyMessage.accountKeys && legacyMessage.instructions) {
        const accountKeys = legacyMessage.accountKeys;
        for (const ix of legacyMessage.instructions) {
          const programId = accountKeys[ix.programIdIndex];
          if (programId && programId.equals(driftProgramId)) {
            driftInstruction = {
              data: ix.data,
              accountsCount: ix.accounts.length,
            };
            break;
          }
        }
      }
    }

    if (!driftInstruction) {
      console.error(`  ✗ No Drift instruction found in transaction`);
      return null;
    }

    const data = Buffer.from(driftInstruction.data);
    const discriminator = data.slice(0, 8);
    const discriminatorBase64 = discriminator.toString("base64");
    const discriminatorHex = discriminator.toString("hex");

    console.log(`  ✓ Found ${instructionName}`);
    console.log(`    Discriminator (base64): ${discriminatorBase64}`);
    console.log(`    Discriminator (hex):    0x${discriminatorHex}`);
    console.log(`    Accounts count:         ${driftInstruction.accountsCount}`);

    return {
      instructionName,
      txHash: signature,
      discriminatorBase64,
      discriminatorHex,
      accountsCount: driftInstruction.accountsCount,
    };
  } catch (error) {
    console.error(`  ✗ Error processing transaction: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export async function verifyDiscriminator(signature: string, instructionName: string, rpcUrl: string) {
  const connection = new Connection(rpcUrl, "confirmed");
  return await extractDiscriminator(connection, signature, instructionName);
}

// Run as standalone script
if (import.meta.main) {
  const rpcUrl = process.env.RPC_URL || process.env.QUICKNODE_RPC_URL;

  if (!rpcUrl) {
    console.error("Error: RPC_URL or QUICKNODE_RPC_URL environment variable is required");
    process.exit(1);
  }

  const signature = process.argv[2];
  const instructionName = process.argv[3] || "unknown";

  if (!signature) {
    console.error("Usage: bun scripts/tools/verify-discriminators.ts <signature> [instructionName]");
    process.exit(1);
  }

  verifyDiscriminator(signature, instructionName, rpcUrl)
    .then(result => {
      if (result) {
        console.log("\n" + "=".repeat(80));
        console.log("Summary");
        console.log("=".repeat(80));
        console.log(`Instruction: ${result.instructionName}`);
        console.log(`Discriminator: ${result.discriminatorBase64}`);
        console.log(`Hex: 0x${result.discriminatorHex}`);
      }
    })
    .catch(console.error);
}
