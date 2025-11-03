# QuickNode Drift Perp Filter

QuickNode Streams用のカスタムフィルターで、Driftプロトコルのperp取引を監視し、デコードします。

## 概要

このプロジェクトは、QuickNode Streamsを使用してDriftプロトコルのperp取引をリアルタイムで監視し、webhookに転送するためのフィルター実装です。

### 責任分担

- **filter.js**: Drift program IDとdiscriminatorでトランザクションをフィルタリング
- **webhook endpoint**: drift-sdkを使用してデータをパース・デコード
- **デコーダーモジュール**: perpオーダーの詳細をデコードして人間が読みやすい形式に変換

## ファイル構成

```
.
├── src/
│   ├── filter.js                    # QuickNode Streams カスタムフィルター
│   ├── const.ts                     # 定数定義（program ID, discriminatorsなど）
│   ├── types.ts                     # 型定義
│   ├── lib/
│   │   ├── drift.ts                 # Drift client初期化
│   │   └── quicknode.ts             # QuickNode API クライアント
│   └── utils/
│       ├── drift-decoder.ts         # Drift instructionデコーダー
│       ├── order-formatter.ts       # オーダーフォーマッター
│       ├── solana.ts                # Solanaユーティリティ
│       ├── env.ts                   # 環境変数管理
│       └── file.ts                  # ファイル操作
├── scripts/
│   ├── test-filter.ts               # フィルターテスト（メイン）
│   ├── test-filter-with-known-txs.ts # 既知のトランザクションでテスト
│   ├── test-decode.ts               # RPCからデコードテスト
│   ├── test-decode-quicknode.ts     # QuickNodeからデコードテスト
│   └── tools/
│       └── verify-discriminators.ts # Discriminator検証ツール
├── docs/
│   ├── quicknode-vs-rpc-format.md   # データフォーマットの違い
│   ├── drift-perp-order-methods.md  # Perpオーダーメソッド説明
│   └── drift-signed-message-decoding.md # 署名付きメッセージデコード
└── README.md
```

## セットアップ

### 環境変数

`.env`ファイルを作成：

```bash
QUICKNODE_RPC_URL=https://your-quicknode-endpoint.solana-mainnet.quiknode.pro/xxx/
QUICKNODE_API_KEY=your_api_key
```

### インストール

```bash
bun install
```

## 使用方法

### フィルターのテスト

特定のトランザクションでテスト：

```bash
bun scripts/test-filter.ts --tx <transaction_signature>
```

特定のスロットでテスト：

```bash
bun scripts/test-filter.ts --block <slot_number>
```

最新のN個のスロットでテスト：

```bash
bun scripts/test-filter.ts --latest 10
```

**出力例:**
```
tx: https://solscan.io/tx/2XZEL1VY8d8ZRgLsjMNAMLDGPt5oPBy1nz9ho2ZZXcLWwmjrscNhRjipX45WiEh7NGKKktabfoCq5dWGGn2DwYvS
method: placeSignedMsgTakerOrder
market: NOT-PERP
direction: Long
size: 4398.0465
price: 15319.70
orderType: Limit
```

### 既知のトランザクションでテスト

```bash
bun scripts/test-filter-with-known-txs.ts
```

7種類のDrift perp instructionをテストし、フィルターが正しく動作することを検証します。

### Discriminatorの検証

新しい命令のdiscriminatorを確認：

```bash
bun scripts/tools/verify-discriminators.ts <signature> <instruction_name>
```

## filter.js の仕様

### 監視対象

- **Program ID**: `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`
- **Instructions**: 
  - `placePerpOrder` (discriminator: `Pe62ShZLxbSn`)
  - `placeAndTakePerpOrder` (discriminator: `oktpafA6BG3U`)
  - `placeAndMakePerpOrder` (discriminator: `qbTdxZcVTFrK`)
  - `placeSignedMsgTakerOrder` (discriminator: `2rC4EaE3zM9d`)
  - `placeAndMakeSignedMsgPerpOrder` (discriminator: `8tyRUgT5LQ4P`)

### 出力フォーマット

```json
{
  "matchedTransactions": [
    {
      "signature": "string",
      "slot": number,
      "blockTime": number,
      "success": boolean,
      "fee": number,
      "instructions": [
        {
          "programId": "string",
          "data": "string (Base58)",
          "accounts": ["string"]
        }
      ],
      "logs": ["string"]
    }
  ]
}
```

## デコーダーモジュール

### Drift Decoder (`src/utils/drift-decoder.ts`)

Drift instructionをデコードします：

```typescript
import { decodeDriftInstructions } from "./src/utils/drift-decoder";

const decodedInstructions = decodeDriftInstructions(tx, driftProgramId, driftClient);
```

**対応instruction:**
- `placeSignedMsgTakerOrder`
- `placeAndMakeSignedMsgPerpOrder`

### Order Formatter (`src/utils/order-formatter.ts`)

デコードされたオーダーを人間が読みやすい形式に変換します：

```typescript
import { formatDecodedOrder, displayFormattedOrder } from "./src/utils/order-formatter";

const formatted = formatDecodedOrder(signature, method, decodedOrder);
displayFormattedOrder(formatted);
```

**変換内容:**
- 16進数の数値を実数に変換（BASE_PRECISION = 10^9, PRICE_PRECISION = 10^6）
- マーケットインデックスをマーケット名に変換（SOL-PERP, BTC-PERP, NOT-PERPなど80種類以上）
- Direction/OrderTypeの列挙型を文字列に変換

## 新しい命令の追加

1. テストトランザクションを見つける（Solscan等）
2. Discriminatorを検証：
   ```bash
   bun scripts/tools/verify-discriminators.ts <signature> <instruction_name>
   ```
3. `src/const.ts`の`TEST_TRANSACTIONS`に追加
4. `src/filter.js`の`PERP_DISCRIMINATORS`配列に追加
5. テストを実行：
   ```bash
   bun scripts/test-filter-with-known-txs.ts
   ```

## 重要な注意事項

### QuickNode vs RPC のデータフォーマット

QuickNode StreamsとSolana RPCは、同じトランザクションを**異なる形式**で返します：

| 項目 | QuickNode | RPC |
|------|-----------|-----|
| DATA | **Base58文字列** | Buffer |
| データ長 | 237バイト（Base58デコード後） | 237バイト |
| データ内容 | ✅ **完全一致**（Base58デコード後） | ✅ **完全一致** |

詳細は `docs/quicknode-vs-rpc-format.md` を参照してください。

### Discriminatorについて

- QuickNode Streamsのdiscriminator形式は、生のRPCデータとは異なります
- Discriminatorは、Base58エンコードされたinstruction dataの最初の12文字です
- フィルターはできるだけシンプルに保ち、複雑な処理はwebhook endpoint側で行います

## 参考資料

- [QuickNode Streams Guide](https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data)
- [QuickNode Test Filter API](https://www.quicknode.com/docs/webhooks/rest-api/webhooks/webhooks-rest-test-filter)
- [Drift Protocol](https://github.com/drift-labs/protocol-v2)
- [Drift SDK Documentation](https://drift-labs.github.io/v2-teacher/)

## ドキュメント

- `docs/quicknode-vs-rpc-format.md` - QuickNode StreamsとRPCのデータフォーマットの違い
- `docs/drift-perp-order-methods.md` - Drift perpオーダーメソッドの説明
- `docs/drift-signed-message-decoding.md` - 署名付きメッセージのデコード方法
- `scripts/README.md` - スクリプトの詳細な使用方法
