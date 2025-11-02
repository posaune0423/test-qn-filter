# QuickNode Drift Perp Filter

QuickNode Streams用のカスタムフィルターで、Driftプロトコルのperp取引を監視します。

## 概要

このプロジェクトは、QuickNode Streamsを使用してDriftプロトコルのperp取引をリアルタイムで監視し、webhookに転送するためのシンプルなフィルター実装です。

### 責任分担

- **filter.js**: Drift program IDとdiscriminatorでトランザクションをフィルタリング
- **webhook endpoint**: drift-sdkを使用してデータをパース・デコード

## ファイル構成

```
.
├── src/
│   ├── filter.js              # QuickNode Streams カスタムフィルター
│   ├── debug-filter.js        # デバッグ用フィルター
│   └── lib/
│       └── quicknode.ts       # QuickNode API クライアント
├── scripts/
│   ├── test-filter.ts         # フィルターテストスクリプト
│   ├── test-filter-with-known-txs.ts  # 既知のトランザクションでテスト
│   └── tools/
│       ├── test-transactions.ts       # テスト用トランザクション定義
│       └── verify-discriminators.ts   # Discriminator検証ツール
└── README.md
```

## セットアップ

### 環境変数

`.env`ファイルを作成：

```bash
QUICKNODE_API_KEY=your_api_key
RPC_URL=your_solana_rpc_url
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

特定のブロックでテスト：

```bash
bun scripts/test-filter.ts --block <slot_number>
```

最新のブロックでテスト：

```bash
bun scripts/test-filter.ts --latest 10
```

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
          "data": "string (base64)",
          "accounts": ["string"]
        }
      ],
      "logs": ["string"]
    }
  ]
}
```

## 新しい命令の追加

1. テストトランザクションを見つける
2. Discriminatorを検証：
   ```bash
   bun scripts/tools/verify-discriminators.ts <signature> <instruction_name>
   ```
3. QuickNode Streamsでの実際のdiscriminatorを確認：
   ```bash
   FILTER_FILE=src/debug-filter.js bun scripts/test-filter.ts --tx <signature>
   ```
4. `filter.js`の`PERP_DISCRIMINATORS`配列に追加

## 参考資料

- [QuickNode Streams Guide](https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data)
- [QuickNode Test Filter API](https://www.quicknode.com/docs/webhooks/rest-api/webhooks/webhooks-rest-test-filter)
- [Drift Protocol](https://github.com/drift-labs/protocol-v2)

## 注意事項

- QuickNode Streamsのdiscriminator形式は、生のRPCデータとは異なります
- Discriminatorは、Base64エンコードされたinstruction dataの最初の12文字です
- フィルターはできるだけシンプルに保ち、複雑な処理はwebhook endpoint側で行います
