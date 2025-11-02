import { PublicKey, type VersionedTransactionResponse } from "@solana/web3.js";
import { DRIFT_PROGRAM_ID, TEST_TRANSACTIONS } from "../src/const";
import { driftClient } from "../src/lib/drift";

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
  decodeDriftInstructions(tx);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// ============== HELPER FUNCTIONS ==============

/**
 * Drift programのinstructionを抽出してデコードする
 */
function decodeDriftInstructions(tx: VersionedTransactionResponse): void {
  console.log("\n=== Drift Instructions ===");

  const message = tx.transaction.message;

  if (!("compiledInstructions" in message)) {
    console.log("Unsupported transaction format (not a versioned transaction)");
    return;
  }

  const accountKeys = message.staticAccountKeys;
  const driftInstructions = message.compiledInstructions.filter((ix) => {
    const programId = accountKeys[ix.programIdIndex];
    return programId?.equals(DRIFT_PROGRAM_ID_PK);
  });

  if (driftInstructions.length === 0) {
    console.log("No Drift instructions found");
    return;
  }

  message.compiledInstructions.forEach((ix, index) => {
    processInstruction(ix, accountKeys, index);
  });
}

/**
 * 単一のinstructionを処理する
 */
function processInstruction(
  ix: VersionedTransactionResponse["transaction"]["message"]["compiledInstructions"][number],
  accountKeys: readonly PublicKey[],
  index: number,
): void {
  const programId = accountKeys[ix.programIdIndex];
  if (!programId) {
    return;
  }

  if (!programId.equals(DRIFT_PROGRAM_ID_PK)) {
    return;
  }

  const ixData = Buffer.from(ix.data);
  console.log(`\n[Instruction ${index}]`);
  console.log(`  Program ID: ${programId.toString()}`);
  console.log(`  Data length: ${ixData.length} bytes`);

  if (ixData.length > 8) {
    decodeSignedMsgOrder(ixData);
  }
}

/**
 * placeSignedMsgTakerOrderのメッセージをデコードする
 *
 * Instruction data構造:
 * - 0-7: instruction discriminator (8 bytes)
 * - 8-11: Vec<u8> length (u32, 4 bytes)
 * - 12-75: signature (64 bytes)
 * - 76-107: signing_authority (32 bytes)
 * - 108-109: message_length (u16, 2 bytes)
 * - 110以降: message (hex文字列としてエンコードされたSignedMsgOrderParamsMessage)
 * - 最後: isDelegateSigner (bool, 1 byte)
 *
 * Drift SDKのdecodeSignedMsgOrderParamsMessageメソッドは、
 * discriminator除去、128バイトパディング追加、IDLバージョン互換性処理を自動的に行います。
 */
function decodeSignedMsgOrder(ixData: Buffer): void {
  const discriminator = ixData.slice(0, 8);

  // placeSignedMsgTakerOrderのdiscriminatorをチェック
  // IE9lixkGYg8= (base64) = 0x204f658b1906620f
  const expectedDiscriminator = Buffer.from([0x20, 0x4f, 0x65, 0x8b, 0x19, 0x06, 0x62, 0x0f]);
  if (!discriminator.equals(expectedDiscriminator)) {
    return;
  }

  console.log(`  Type: placeSignedMsgTakerOrder`);

  // Instruction discriminatorを除去
  const dataAfterDiscriminator = ixData.slice(8);

  if (dataAfterDiscriminator.length < 107) {
    console.error("  Error: Data too short");
    return;
  }

  // Vec<u8>の長さを取得
  const vecLength = dataAfterDiscriminator.readUInt32LE(0);

  // signature(64) + signing_authority(32) + message_length(2) + message(hex文字列)
  const signature = dataAfterDiscriminator.slice(4, 68);
  const signingAuthority = dataAfterDiscriminator.slice(68, 100);
  const messageLengthRaw = dataAfterDiscriminator.readUInt16LE(100);
  const messageHexString = dataAfterDiscriminator.slice(102, 102 + messageLengthRaw).toString("ascii");

  // isDelegateSignerはVec<u8>の後（1バイト）
  const isDelegateSignerIndex = 4 + vecLength;
  if (dataAfterDiscriminator.length < isDelegateSignerIndex + 1) {
    console.error("  Error: Data too short for isDelegateSigner");
    return;
  }

  const isDelegateSigner = dataAfterDiscriminator.readUInt8(isDelegateSignerIndex) === 1;

  console.log(`  Signature: ${signature.toString("hex").slice(0, 32)}...`);
  console.log(`  Signing authority: ${signingAuthority.toString("hex").slice(0, 32)}...`);
  console.log(`  Is delegate signer: ${isDelegateSigner}`);

  // SDKの便利関数を使用したシンプルなデコード（2行で完了）
  // 1. hex文字列からBufferへ変換
  const signedMsgOrderParamsBuf = Buffer.from(messageHexString, "hex");

  // 2. SDKメソッドでデコード（discriminator除去とパディングは自動）
  try {
    const decodedMessage = driftClient.decodeSignedMsgOrderParamsMessage(
      signedMsgOrderParamsBuf,
      isDelegateSigner
    );
    console.log(`\n  ✅ Decoded message:`);
    console.log(JSON.stringify(decodedMessage, null, 2));
  } catch (error) {
    console.error(`  ❌ Decode failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
