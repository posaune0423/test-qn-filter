# Scripts

このディレクトリには、Drift ProtocolのQuickNode Streamsフィルターのテストとデバッグ用のスクリプトが含まれています。

## メインスクリプト

### `test-filter.ts`

QuickNode Streamsのフィルター機能をテストし、perpオーダーをデコードして表示します。

**使用方法:**

```bash
# 特定のトランザクションをテスト
bun run scripts/test-filter.ts --tx <signature>

# 特定のスロットをテスト
bun run scripts/test-filter.ts --block <slot>

# 最新のN個のスロットをテスト
bun run scripts/test-filter.ts --latest 10
```

**機能:**
- QuickNode Streamsフィルターのテスト
- マッチしたperpオーダーのデコードと表示
- 人間が読みやすいフォーマットで出力（market, direction, size, priceなど）

**出力例:**
```
tx: https://solscan.io/tx/[signature]
method: placeSignedMsgTakerOrder
market: NOT-PERP
direction: Long
size: 4398.0465
price: 15319.70
orderType: Limit
```

### `test-filter-with-known-txs.ts`

既知のテストトランザクションを使用してフィルターの正確性を検証します。

**使用方法:**

```bash
bun run scripts/test-filter-with-known-txs.ts
```

**機能:**
- 7種類のDrift perp instructionをテスト
- フィルターが正しくマッチ/除外するか検証
- デコード可能なオーダーは詳細を表示

**テスト対象:**
- placePerpOrder
- placeAndTakePerpOrder
- placeAndMakePerpOrder
- placeSignedMsgTakerOrder
- placeAndMakeSignedMsgPerpOrder
- placeSpotOrder（除外されるべき）
- placeOrders（除外されるべき）

### `test-decode.ts`

Solana RPCからトランザクションを取得し、Drift instructionをデコードします。

**使用方法:**

```bash
bun run scripts/test-decode.ts
```

**機能:**
- トランザクションの基本情報を表示
- Drift programのinstructionを抽出
- `placeSignedMsgTakerOrder`のメッセージをデコード

### `test-decode-quicknode.ts`

QuickNode Streams APIを使用してトランザクションデータを取得し、デコードします。

**使用方法:**

```bash
bun run scripts/test-decode-quicknode.ts
```

**機能:**
- QuickNode test-filter APIを使用してトランザクションを取得
- Base58エンコードされたdataをデコード
- perpオーダーの詳細を表示

## ツールスクリプト (`tools/`)

### `verify-discriminators.ts`

トランザクションのdiscriminatorを検証します。新しいテストトランザクションを追加する際に使用します。

**使用方法:**

```bash
bun scripts/tools/verify-discriminators.ts <signature> <instructionName>
```

**例:**
```bash
bun scripts/tools/verify-discriminators.ts 2XZEL1VY8d8... placeSignedMsgTakerOrder
```

## 環境変数

以下の環境変数が必要です：

- `QUICKNODE_RPC_URL`: QuickNode RPC URL（必須）
- `QUICKNODE_API_KEY`: QuickNode API Key（Streams APIを使用する場合、必須）

`.env`ファイルに設定してください：

```env
QUICKNODE_RPC_URL=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/xxx/
QUICKNODE_API_KEY=your-api-key
```

## 実装の詳細

### デコーダーモジュール

`src/utils/drift-decoder.ts`モジュールは、Drift instructionのデコード機能を提供します：

```typescript
import { decodeDriftInstructions, formatDecodedInstruction } from "../src/utils/drift-decoder";

// トランザクションからDrift instructionsをデコード
const decodedInstructions = decodeDriftInstructions(tx, driftProgramId, driftClient);

// 結果を出力
for (const decoded of decodedInstructions) {
  console.log(formatDecodedInstruction(decoded));
}
```

### フォーマッターモジュール

`src/utils/order-formatter.ts`モジュールは、デコードされたオーダーを人間が読みやすい形式に変換します：

```typescript
import { formatDecodedOrder, displayFormattedOrder } from "../src/utils/order-formatter";

// デコードされたオーダーをフォーマット
const formatted = formatDecodedOrder(signature, method, decodedOrder);

// 表示
displayFormattedOrder(formatted);
```

**変換内容:**
- 16進数の数値を実数に変換（BASE_PRECISION = 10^9, PRICE_PRECISION = 10^6）
- マーケットインデックスをマーケット名に変換（SOL-PERP, BTC-PERP, NOT-PERPなど）
- Direction/OrderTypeの列挙型を文字列に変換

## 参考ドキュメント

- `../docs/quicknode-vs-rpc-format.md` - QuickNode StreamsとRPCのデータフォーマットの違い
- `../docs/drift-perp-order-methods.md` - Drift perpオーダーメソッドの説明
- `../docs/drift-signed-message-decoding.md` - 署名付きメッセージのデコード方法
