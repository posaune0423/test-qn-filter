# Scripts

このディレクトリには、Drift ProtocolのQuickNode Streamsフィルターのテストとデバッグ用のスクリプトが含まれています。

## メインスクリプト

### `test-decode.ts`

Solana RPCからトランザクションを取得し、`placeSignedMsgTakerOrder`のinstruction dataをデコードします。

**使用方法:**

```bash
bun run scripts/test-decode.ts
```

**機能:**

- トランザクションの基本情報を表示
- Drift programのinstructionを抽出
- `placeSignedMsgTakerOrder`のメッセージをデコード
  - Signature
  - Signing authority
  - Order parameters (orderType, direction, price, etc.)
  - Sub-account ID
  - Slot
  - UUID

**重要な実装の詳細:**

`placeSignedMsgTakerOrder`のinstruction dataは以下の構造を持ちます：

```
- 0-7: instruction discriminator (8 bytes)
- 8-11: Vec<u8> length (u32, 4 bytes)
- 12-75: signature (64 bytes)
- 76-107: signing_authority (32 bytes)
- 108-109: message_length (u16, 2 bytes)
- 110以降: message (hex文字列としてエンコードされたSignedMsgOrderParamsMessage)
- 最後: isDelegateSigner (bool, 1 byte)
```

**Drift SDKの便利関数によるデコード:**

Drift SDKの`decodeSignedMsgOrderParamsMessage`メソッドを使用すると、わずか2行でデコードが完了します：

```typescript
// 1. hex文字列からBufferへ変換
const signedMsgOrderParamsBuf = Buffer.from(messageHexString, "hex");

// 2. SDKメソッドでデコード（discriminator除去とパディングは自動）
const decodedMessage = driftClient.decodeSignedMsgOrderParamsMessage(
  signedMsgOrderParamsBuf,
  isDelegateSigner
);
```

SDKが内部で自動的に行う処理：
- discriminator（最初の8バイト）の除去
- 128バイトのパディング追加（メッセージが小さい場合）
- IDLバージョン互換性処理

この実装は、オンチェーンのRustコード（`sig_verification.rs`）と同様のロジックで動作します。

### `test-decode-quicknode.ts`

QuickNode Streams APIを使用してトランザクションデータを取得し、instruction dataを表示します。

**使用方法:**

```bash
bun run scripts/test-decode-quicknode.ts
```

### `test-filter.ts`

QuickNode Streamsのフィルター機能をテストします。

**使用方法:**

```bash
bun run scripts/test-filter.ts
```

### `test-filter-with-known-txs.ts`

既知のトランザクションを使用してフィルターをテストします。

**使用方法:**

```bash
bun run scripts/test-filter-with-known-txs.ts
```

## 分析スクリプト

### `compare-discriminators.ts`

QuickNode StreamsとRPCのdiscriminatorを比較します。

### `compare-instruction-formats.ts`

QuickNode StreamsとRPCのinstruction dataフォーマットを比較します。

### `analyze-format-differences.ts`

QuickNode StreamsとRPCのデータフォーマットの違いを詳細に分析します。

## ツールスクリプト (`tools/`)

### `verify-discriminators.ts`

トランザクションのdiscriminatorを検証します。

**使用方法:**

```bash
bun scripts/tools/verify-discriminators.ts <signature> <instructionName>
```

### `find-drift-transactions.ts`

特定のブロック範囲からDriftトランザクションを検索します。

### `analyze-transaction-details.ts`

トランザクションの詳細を分析します。

### `analyze-all-instructions.ts`

トランザクション内のすべてのinstruction（CPIを含む）を分析します。

### `get-quicknode-discriminators.ts`

QuickNode Streamsから実際のdiscriminatorを取得します。

### `test-transactions.ts`

テストトランザクションを実行します。

## 環境変数

以下の環境変数が必要です：

- `QUICKNODE_RPC_URL`: QuickNode RPC URL
- `QUICKNODE_API_KEY`: QuickNode API Key (Streams APIを使用する場合)

`.env`ファイルに設定してください。
