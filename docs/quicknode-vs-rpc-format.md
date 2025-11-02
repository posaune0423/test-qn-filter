# QuickNode vs RPC Instruction Format Comparison

## 概要

QuickNode StreamsとSolana RPCは、同じトランザクションを異なる形式で返します。このドキュメントは、両者の形式の違いと変換方法を説明します。

## 調査結果

### DATAフィールドのエンコーディング

#### QuickNode形式
- **形式**: **Base58エンコードされた文字列**
- **例**: `"2rC4EaE3zM9ducEomG2BdMhk8D4hWcL2mPZXtk1aGd7BYxEcQ5..."`
- **長さ**: 324文字（Base58エンコード後）
- **デコード後**: 237バイト
- **参考**: [QuickNode Documentation](https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data)

#### RPC形式
- **形式**: Raw Bufferオブジェクト
- **例**: `<Buffer 20 4f 65 8b 19 06 62 0f e0 00 00 00 ...>`
- **長さ**: 237バイト

#### 重要な発見
✅ **Base58デコード後、データは完全に一致します**
- QuickNodeはBase58エンコードされた文字列を返します
- RPCは生のBufferを返します
- Base58デコード後、両者のバイナリデータは同一です
- 長さも一致します（237バイト）
- 最初のバイトも一致します
  - QuickNode (Base58デコード後): `0x20 0x4f 0x65 0x8b ...`
  - RPC: `0x20 0x4f 0x65 0x8b ...`

## 変換方法

### QuickNode → RPC形式への変換

#### DATAフィールド
```typescript
import { decodeBase58 } from "./src/utils/solana";

// QuickNode形式
const qnData = "2rC4EaE3zM9d..."; // Base58 string

// RPC形式への変換
const rpcBuffer = Buffer.from(decodeBase58(qnData));
// ✅ Base58デコード後、データはRPCのBufferと完全に一致します
```

または、`bs58`ライブラリを使用する場合:
```typescript
import bs58 from "bs58";

const rpcBuffer = Buffer.from(bs58.decode(qnData));
```

### RPC → QuickNode形式への変換

#### DATAフィールド
```typescript
import bs58 from "bs58";

// RPC形式
const rpcBuffer = Buffer.from([0x20, 0x4f, ...]);

// QuickNode形式への変換
const qnData = bs58.encode(rpcBuffer);
// ✅ Base58エンコード後、データはQuickNodeの形式と完全に一致します
```

## 推奨事項

1. **QuickNode Streamsを使用する場合**
   - QuickNodeの形式を直接使用する
   - フィルタ関数内では、QuickNodeが提供する形式をそのまま使用
   - DATAフィールドはBase58エンコードされた文字列として扱う

2. **Solana RPCを使用する場合**
   - RPCの形式を直接使用する
   - 標準的なSolana RPCコールでは、RPCの形式を使用
   - DATAフィールドはBufferオブジェクトとして扱う

3. **変換方法**
   - DATAフィールドはBase58エンコード/デコードで完全に変換可能
   - `decodeBase58()`（プロジェクト内のユーティリティ）または`bs58.decode()`を使用して変換
   - 変換後、データは完全に一致することを確認済み

## 実装例

詳細な比較と変換の実装は以下のスクリプトを参照してください:

- `scripts/compare-instruction-formats.ts` - すべてのinstructionのデータフィールドを比較
- `scripts/analyze-format-differences.ts` - 形式の違いの分析

## まとめ

QuickNode StreamsとSolana RPCは、同じトランザクションを異なる形式で返します:

| 項目 | QuickNode | RPC |
|------|-----------|-----|
| DATA | **Base58文字列** | Buffer |
| データ長 | 237バイト（Base58デコード後） | 237バイト |
| データ内容 | ✅ **完全一致**（Base58デコード後） | ✅ **完全一致** |

**結論**: QuickNodeのDATAフィールドはBase58エンコードされた文字列で、`decodeBase58()`または`bs58.decode()`でデコードするとRPCのBufferと完全に一致します。
