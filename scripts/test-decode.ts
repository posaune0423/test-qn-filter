import { PublicKey } from "@solana/web3.js";
import { DRIFT_PROGRAM_ID, TEST_TRANSACTIONS } from "../src/const";
import { driftClient } from "../src/lib/drift";
import { decodeDriftInstructions, formatDecodedInstruction } from "../src/utils/drift-decoder";

const DRIFT_PROGRAM_ID_PK = new PublicKey(DRIFT_PROGRAM_ID);

async function main() {
  const signature = TEST_TRANSACTIONS.placeSignedMsgTakerOrder.signature;

  console.log(`Fetching transaction: ${signature}`);

  // Subscribeをawaitで待機
  await driftClient.subscribe();

  // トランザクションを取得
  const tx = await driftClient.connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });

  // nullチェック
  if (!tx) {
    throw new Error(`Transaction not found: ${signature}`);
  }

  // トランザクションの基本情報を出力
  console.log("\n=== Transaction Info ===");
  console.log(`Slot: ${tx.slot}`);
  console.log(`Block time: ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "N/A"}`);
  console.log(`Error: ${tx.meta?.err ? JSON.stringify(tx.meta.err) : "None"}`);

  // Drift instructionsをデコード
  console.log("\n=== Drift Instructions ===");
  const decodedInstructions = decodeDriftInstructions(tx, DRIFT_PROGRAM_ID_PK, driftClient);

  if (decodedInstructions.length === 0) {
    console.log("No Drift instructions found");
    return;
  }

  // デコード結果を出力
  for (const decoded of decodedInstructions) {
    console.log(`\n${formatDecodedInstruction(decoded)}`);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
