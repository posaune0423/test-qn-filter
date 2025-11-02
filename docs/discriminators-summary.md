# Drift Protocol Discriminators Summary

このドキュメントは、Drift Protocolの各instruction typeのdiscriminatorをまとめたものです。

## Perp Instructions (フィルター対象)

これらのinstructionはperp取引専用で、フィルターに含まれます。

| Instruction Name | Discriminator (Base64) | Discriminator (Hex) | Test Transaction |
|-----------------|----------------------|-------------------|-----------------|
| `placePerpOrder` | `RaFdynh+TLk=` | `0x45a15dca787e4cb9` | [KiQ1uR...meLLvL](https://solscan.io/tx/KiQ1uRDXW6YFG3V8NruXoLDpmmxRgWw44nYBcFTwCeZ53mY9ZKVGGGzJdT61rbiq4En8WpV9BXTi7JDZ3meLLvL) |
| `placeAndTakePerpOrder` | `1TMBu2zc5uA=` | `0xd53301bb6cdce6e0` | [5tGQLy...7Njky](https://solscan.io/tx/5tGQLySmvNnQ7ZfzKUZc6qWcB4CBj1SYFT1gd2Lb1wCGVHG4bmPw9bkLvHhc6KDYTQgzaWBd7LroYcdTfz37Njky) |
| `placeAndMakePerpOrder` | `lXUL7S9fWe0=` | `0x95750bed2f5f59ed` | [PYjgxK...crAF1](https://solscan.io/tx/PYjgxKZB5UrU4sJqMmDj6mkgc1qw4K6cmi1y9EynxcQSE3M3B1svPhn1Dz2EfWhKvxv2Sqcz5BYnC4dYHscrAF1) |
| `placeSignedMsgTakerOrder` | `IE9lixkGYg8=` | `0x204f658b1906620f` | [2XZEL1...DwYvS](https://solscan.io/tx/2XZEL1VY8d8ZRgLsjMNAMLDGPt5oPBy1nz9ho2ZZXcLWwmjrscNhRjipX45WiEh7NGKKktabfoCq5dWGGn2DwYvS) |
| `placeAndMakeSignedMsgPerpOrder` | `IE9lixkGYg8=` | `0x204f658b1906620f` | [2EfEUs...oex28](https://solscan.io/tx/2EfEUs1ieBCWxBXnTakkH9cdTH6DbBzyTJte9uxjuGmZJ2Teza2jwBH7T4EgtNXUQyPRnDYfZSgyj8nXTjtoex28) |

## Non-Perp Instructions (フィルター対象外)

これらのinstructionはperp専用ではないため、フィルターから除外されます。

| Instruction Name | Discriminator (Base64) | Discriminator (Hex) | Test Transaction | Note |
|-----------------|----------------------|-------------------|-----------------|------|
| `placeOrder` | `PD8yewzFPL4=` | `0x3c3f327b0cc53cbe` | [3eZ7u4...NNeuzJ](https://solscan.io/tx/3eZ7u4p5qA6e8q6r6PpLkpPZccD51wvfyHZ43TanpecohVMAkfStsN5HqTK8NLCf2PzBjRACTqJL6fM99PNNeuzJ) | Spot order |
| `placeOrders` | `PD8yewzFPL4=` | `0x3c3f327b0cc53cbe` | [wYF3Pk...Rvg7B](https://solscan.io/tx/wYF3PkQxeJNQu1je5aHpB8ykJeij4bsfhhhPobgQkyuogrNvCwTrFFgaASKDzhCDVTYediTcZDxHrCNa94Rvg7B) | Batch orders (perp/spot) |

## 重要な注意事項

### 1. QuickNode Streamsのdiscriminatorフォーマット

QuickNode Streamsでは、instruction dataの**最初の12文字**（Base64）を使用します：

```javascript
// ✅ 正しい (最初の12文字)
'RaFdynh+TLk='  // 12文字

// ❌ 間違い (完全なBase64)
'RaFdynh+TLk='  // 16文字
```

### 2. 同じdiscriminatorを持つinstruction

以下のinstructionは同じdiscriminatorを使用します：

- `placeOrder` と `placeOrders`: `PD8yewzFPL4=`
  - 両方ともperp専用ではないため、フィルターから除外

- `placeSignedMsgTakerOrder` と `placeAndMakeSignedMsgPerpOrder`: `IE9lixkGYg8=`
  - **重要**: これらは実際には同じdiscriminatorではなく、`placeAndMakeSignedMsgPerpOrder`は`placeSignedMsgTakerOrder`の中から呼び出されるCPI（Cross-Program Invocation）です
  - トップレベルのinstructionは両方とも`placeSignedMsgTakerOrder`なので、同じdiscriminatorになります
  - フィルターでは`IE9lixkGYg8=`をキャッチすることで、両方のケースを正しく処理できます

### 3. Discriminatorの計算方法

Anchor frameworkでは、discriminatorは以下のように計算されます：

```typescript
const discriminator = sha256(`global:${instructionName}`).slice(0, 8);
```

8バイトのdiscriminatorをBase64エンコードすると、12文字になります。

**重要**: QuickNode Streamsでキャッチされるdiscriminatorは、**トップレベルのinstruction**のものです。Nested CPI（Cross-Program Invocation）のdiscriminatorは直接見えません。

### 4. CPI（Cross-Program Invocation）について

一部のDrift instructionは、他のinstructionの中から呼び出されます：

```
placeSignedMsgTakerOrder (トップレベル)
└── JitSignedMsg (CPI)
    └── placeAndMakeSignedMsgPerpOrder (CPI)
```

この場合、QuickNode Streamsが見るdiscriminatorは`placeSignedMsgTakerOrder`のものだけです。これは設計として正しく、`placeSignedMsgTakerOrder`をフィルタリングすることで、その中で呼ばれる全てのCPIも含めてキャッチできます。

## フィルター実装

`src/filter.js`では、以下のdiscriminatorを監視します：

```javascript
const PERP_DISCRIMINATORS = [
    'RaFdynh+TLk=',  // placePerpOrder
    '1TMBu2zc5uA=',  // placeAndTakePerpOrder
    'lXUL7S9fWe0=',  // placeAndMakePerpOrder
    'IE9lixkGYg8=',  // placeSignedMsgTakerOrder & placeAndMakeSignedMsgPerpOrder
];
```

## テスト方法

### 全トランザクションのテスト

```bash
bun scripts/test-filter-with-known-txs.ts
```

### 特定のトランザクションのdiscriminator検証

```bash
bun scripts/tools/verify-discriminators.ts <signature> <instructionName>
```

### 新しいトランザクションの探索

```bash
bun scripts/tools/find-drift-transactions.ts --blocks 100
```

## 参考資料

- [Drift Protocol Documentation](https://docs.drift.trade/)
- [Anchor Framework Discriminators](https://www.anchor-lang.com/docs/the-accounts-struct#discriminator)
- [QuickNode Streams Guide](https://www.quicknode.com/guides/quicknode-products/streams/how-to-stream-solana-program-data)
