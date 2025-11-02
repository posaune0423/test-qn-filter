/**
 * Drift Protocol Instruction Decoder
 *
 * このモジュールは、Drift ProtocolのSolana instructionをデコードするためのユーティリティを提供します。
 * 特に`placeSignedMsgTakerOrder`のデコードに対応しています。
 *
 * 主な機能:
 * - Instruction discriminatorの検証
 * - 署名付きメッセージのパース
 * - Drift SDKを使用した自動デコード
 */

import type { PublicKey, VersionedTransactionResponse } from "@solana/web3.js";
import type { DriftClient } from "@drift-labs/sdk";

// ============== Types ==============

/**
 * placeSignedMsgTakerOrderのデコード結果
 */
export type DecodedSignedMsgOrder = {
  signature: Buffer;
  signingAuthority: Buffer;
  isDelegateSigner: boolean;
  message: unknown; // Drift SDKの型に依存
};

/**
 * Instructionのデコード結果
 */
export type DecodedInstruction = {
  index: number;
  programId: string;
  dataLength: number;
  type: "placeSignedMsgTakerOrder" | "unknown";
  decoded?: DecodedSignedMsgOrder;
  error?: string;
};

// ============== Constants ==============

/**
 * placeSignedMsgTakerOrderのdiscriminator
 * base64: IE9lixkGYg8=
 * hex: 0x204f658b1906620f
 */
const PLACE_SIGNED_MSG_TAKER_ORDER_DISCRIMINATOR = Buffer.from([
  0x20, 0x4f, 0x65, 0x8b, 0x19, 0x06, 0x62, 0x0f,
]);

// ============== Core Functions ==============

/**
 * Instruction discriminatorをチェック
 *
 * @param ixData - Instruction data
 * @returns discriminatorが一致する場合true
 */
export function isPlaceSignedMsgTakerOrder(ixData: Buffer): boolean {
  if (ixData.length < 8) {
    return false;
  }
  const discriminator = ixData.slice(0, 8);
  return discriminator.equals(PLACE_SIGNED_MSG_TAKER_ORDER_DISCRIMINATOR);
}

/**
 * placeSignedMsgTakerOrderのメッセージをデコード
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
 *
 * @param ixData - Instruction data
 * @param driftClient - Drift client instance
 * @returns デコード結果、またはエラー時はundefined
 */
export function decodeSignedMsgOrder(
  ixData: Buffer,
  driftClient: DriftClient
): DecodedSignedMsgOrder | undefined {
  // Discriminatorチェック
  if (!isPlaceSignedMsgTakerOrder(ixData)) {
    return undefined;
  }

  // Instruction discriminatorを除去
  const dataAfterDiscriminator = ixData.slice(8);

  // 最小長チェック
  if (dataAfterDiscriminator.length < 107) {
    throw new Error("Data too short");
  }

  // Vec<u8>の長さを取得
  const vecLength = dataAfterDiscriminator.readUInt32LE(0);

  // signature(64) + signing_authority(32) + message_length(2) + message(hex文字列)
  const signature = dataAfterDiscriminator.slice(4, 68);
  const signingAuthority = dataAfterDiscriminator.slice(68, 100);
  const messageLengthRaw = dataAfterDiscriminator.readUInt16LE(100);
  const messageHexString = dataAfterDiscriminator
    .slice(102, 102 + messageLengthRaw)
    .toString("ascii");

  // isDelegateSignerはVec<u8>の後（1バイト）
  const isDelegateSignerIndex = 4 + vecLength;
  if (dataAfterDiscriminator.length < isDelegateSignerIndex + 1) {
    throw new Error("Data too short for isDelegateSigner");
  }

  const isDelegateSigner =
    dataAfterDiscriminator.readUInt8(isDelegateSignerIndex) === 1;

  // SDKの便利関数を使用したシンプルなデコード（2行で完了）
  // 1. hex文字列からBufferへ変換
  const signedMsgOrderParamsBuf = Buffer.from(messageHexString, "hex");

  // 2. SDKメソッドでデコード（discriminator除去とパディングは自動）
  const message = driftClient.decodeSignedMsgOrderParamsMessage(
    signedMsgOrderParamsBuf,
    isDelegateSigner
  );

  return {
    signature,
    signingAuthority,
    isDelegateSigner,
    message,
  };
}

/**
 * 単一のinstructionを処理してデコード
 *
 * @param ix - Compiled instruction
 * @param accountKeys - Account keys
 * @param index - Instruction index
 * @param driftProgramId - Drift program ID
 * @param driftClient - Drift client instance
 * @returns デコード結果
 */
export function decodeInstruction(
  ix: VersionedTransactionResponse["transaction"]["message"]["compiledInstructions"][number],
  accountKeys: readonly PublicKey[],
  index: number,
  driftProgramId: PublicKey,
  driftClient: DriftClient
): DecodedInstruction {
  const programId = accountKeys[ix.programIdIndex];

  if (!programId) {
    return {
      index,
      programId: "unknown",
      dataLength: 0,
      type: "unknown",
      error: "Program ID not found",
    };
  }

  if (!programId.equals(driftProgramId)) {
    return {
      index,
      programId: programId.toString(),
      dataLength: Buffer.from(ix.data).length,
      type: "unknown",
      error: "Not a Drift instruction",
    };
  }

  const ixData = Buffer.from(ix.data);

  // placeSignedMsgTakerOrderのデコードを試行
  if (isPlaceSignedMsgTakerOrder(ixData)) {
    try {
      const decoded = decodeSignedMsgOrder(ixData, driftClient);
      return {
        index,
        programId: programId.toString(),
        dataLength: ixData.length,
        type: "placeSignedMsgTakerOrder",
        decoded,
      };
    } catch (error) {
      return {
        index,
        programId: programId.toString(),
        dataLength: ixData.length,
        type: "placeSignedMsgTakerOrder",
        error:
          error instanceof Error ? error.message : "Unknown decode error",
      };
    }
  }

  return {
    index,
    programId: programId.toString(),
    dataLength: ixData.length,
    type: "unknown",
  };
}

/**
 * トランザクションからDrift instructionsを抽出してデコード
 *
 * @param tx - Versioned transaction response
 * @param driftProgramId - Drift program ID
 * @param driftClient - Drift client instance
 * @returns デコードされたinstructionの配列
 */
export function decodeDriftInstructions(
  tx: VersionedTransactionResponse,
  driftProgramId: PublicKey,
  driftClient: DriftClient
): DecodedInstruction[] {
  const message = tx.transaction.message;

  if (!("compiledInstructions" in message)) {
    return [];
  }

  const accountKeys = message.staticAccountKeys;
  const results: DecodedInstruction[] = [];

  for (const [index, ix] of message.compiledInstructions.entries()) {
    const result = decodeInstruction(
      ix,
      accountKeys,
      index,
      driftProgramId,
      driftClient
    );

    // Drift instructionのみを結果に含める
    if (result.type !== "unknown" || result.error !== "Not a Drift instruction") {
      results.push(result);
    }
  }

  return results;
}

// ============== Helper Functions ==============

/**
 * デコード結果を人間が読みやすい形式でフォーマット
 *
 * @param decoded - デコード結果
 * @returns フォーマットされた文字列
 */
export function formatDecodedInstruction(decoded: DecodedInstruction): string {
  const lines: string[] = [];

  lines.push(`[Instruction ${decoded.index}]`);
  lines.push(`  Program ID: ${decoded.programId}`);
  lines.push(`  Data length: ${decoded.dataLength} bytes`);
  lines.push(`  Type: ${decoded.type}`);

  if (decoded.error) {
    lines.push(`  ❌ Error: ${decoded.error}`);
    return lines.join("\n");
  }

  if (decoded.decoded) {
    lines.push(
      `  Signature: ${decoded.decoded.signature.toString("hex").slice(0, 32)}...`
    );
    lines.push(
      `  Signing authority: ${decoded.decoded.signingAuthority.toString("hex").slice(0, 32)}...`
    );
    lines.push(`  Is delegate signer: ${decoded.decoded.isDelegateSigner}`);
    lines.push(`\n  ✅ Decoded message:`);
    lines.push(JSON.stringify(decoded.decoded.message, null, 2));
  }

  return lines.join("\n");
}
