# Utils

このディレクトリには、プロジェクト全体で使用される汎用的なユーティリティ関数が含まれています。

## `drift-decoder.ts`

Drift ProtocolのSolana instructionをデコードするためのユーティリティモジュールです。

### 主な機能

- **Instruction discriminatorの検証**: `placeSignedMsgTakerOrder`かどうかを判定
- **署名付きメッセージのパース**: Instruction dataから署名、署名者、メッセージを抽出
- **Drift SDKを使用した自動デコード**: discriminator除去とパディングを自動実行

### 使用例

#### 基本的な使用方法

```typescript
import { PublicKey } from "@solana/web3.js";
import { driftClient } from "../lib/drift";
import { decodeDriftInstructions, formatDecodedInstruction } from "../utils/drift-decoder";

// トランザクションを取得
const tx = await connection.getTransaction(signature, {
  maxSupportedTransactionVersion: 0,
});

// Drift instructionsをデコード
const driftProgramId = new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH");
const decodedInstructions = decodeDriftInstructions(tx, driftProgramId, driftClient);

// 結果を出力
for (const decoded of decodedInstructions) {
  console.log(formatDecodedInstruction(decoded));
}
```

#### 個別の関数を使用

```typescript
import { isPlaceSignedMsgTakerOrder, decodeSignedMsgOrder } from "../utils/drift-decoder";

// Discriminatorチェック
const ixData = Buffer.from(instruction.data);
if (isPlaceSignedMsgTakerOrder(ixData)) {
  // デコード
  const decoded = decodeSignedMsgOrder(ixData, driftClient);
  
  console.log("Signature:", decoded.signature.toString("hex"));
  console.log("Signing authority:", decoded.signingAuthority.toString("hex"));
  console.log("Is delegate signer:", decoded.isDelegateSigner);
  console.log("Message:", decoded.message);
}
```

### エクスポートされる型

#### `DecodedSignedMsgOrder`

```typescript
type DecodedSignedMsgOrder = {
  signature: Buffer;              // 署名（64バイト）
  signingAuthority: Buffer;       // 署名者の公開鍵（32バイト）
  isDelegateSigner: boolean;      // デリゲート署名者かどうか
  message: unknown;               // デコードされたメッセージ（Drift SDKの型）
};
```

#### `DecodedInstruction`

```typescript
type DecodedInstruction = {
  index: number;                  // Instruction index
  programId: string;              // Program ID
  dataLength: number;             // Data length
  type: "placeSignedMsgTakerOrder" | "unknown";  // Instruction type
  decoded?: DecodedSignedMsgOrder;  // デコード結果（成功時）
  error?: string;                 // エラーメッセージ（失敗時）
};
```

### エクスポートされる関数

#### `isPlaceSignedMsgTakerOrder(ixData: Buffer): boolean`

Instruction dataが`placeSignedMsgTakerOrder`かどうかを判定します。

**パラメータ:**
- `ixData`: Instruction data

**戻り値:**
- `true`: `placeSignedMsgTakerOrder`の場合
- `false`: それ以外の場合

#### `decodeSignedMsgOrder(ixData: Buffer, driftClient: DriftClient): DecodedSignedMsgOrder | undefined`

`placeSignedMsgTakerOrder`のメッセージをデコードします。

**パラメータ:**
- `ixData`: Instruction data
- `driftClient`: Drift client instance

**戻り値:**
- `DecodedSignedMsgOrder`: デコード成功時
- `undefined`: discriminatorが一致しない場合

**例外:**
- `Error`: データが短すぎる場合やデコードに失敗した場合

#### `decodeInstruction(...): DecodedInstruction`

単一のinstructionを処理してデコードします。

**パラメータ:**
- `ix`: Compiled instruction
- `accountKeys`: Account keys
- `index`: Instruction index
- `driftProgramId`: Drift program ID
- `driftClient`: Drift client instance

**戻り値:**
- `DecodedInstruction`: デコード結果

#### `decodeDriftInstructions(...): DecodedInstruction[]`

トランザクションからDrift instructionsを抽出してデコードします。

**パラメータ:**
- `tx`: Versioned transaction response
- `driftProgramId`: Drift program ID
- `driftClient`: Drift client instance

**戻り値:**
- `DecodedInstruction[]`: デコードされたinstructionの配列

#### `formatDecodedInstruction(decoded: DecodedInstruction): string`

デコード結果を人間が読みやすい形式でフォーマットします。

**パラメータ:**
- `decoded`: デコード結果

**戻り値:**
- フォーマットされた文字列

### Instruction Data構造

`placeSignedMsgTakerOrder`のinstruction dataは以下の構造を持ちます：

```
Offset  | Size | Description
--------|------|--------------------------------------------------
0-7     | 8    | instruction discriminator (0x204f658b1906620f)
8-11    | 4    | Vec<u8> length (u32, little-endian)
12-75   | 64   | signature
76-107  | 32   | signing_authority
108-109 | 2    | message_length (u16, little-endian)
110-... | var  | message (hex文字列としてエンコード)
...     | 1    | isDelegateSigner (bool)
```

### 内部実装の詳細

このモジュールは、Drift SDKの`decodeSignedMsgOrderParamsMessage`メソッドを使用しています。このメソッドは以下の処理を自動的に行います：

1. **Discriminator除去**: メッセージの最初の8バイトを除去
2. **128バイトパディング**: メッセージが小さい場合、自動的にパディングを追加
3. **IDLバージョン互換性**: 異なるIDLバージョン間での互換性を保証

この実装は、オンチェーンのRustコード（`sig_verification.rs`）と同様のロジックで動作します。

### 参考資料

- [Drift SDK Documentation](https://github.com/drift-labs/protocol-v2)
- [Drift Signed Message Decoding Guide](../../docs/drift-signed-message-decoding.md)
