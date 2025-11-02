# Driftプロトコルのperp注文メソッド一覧

Driftプロトコルには、異なる実行戦略を持つ複数のperp注文配置メソッドがあります。

## 基本的な注文配置メソッド

### 1. `placePerpOrder` - 標準注文配置

最も基本的なメソッドで、注文をオーダーブックに配置します。

**特徴:**

- 注文を配置するのみで、即座の約定は試みない
- リミット注文・マーケット注文の両方に対応
- IOC（Immediate-or-Cancel）注文は使用不可

**用途:** 通常の取引で最も一般的に使用

### 2. `placeAndTakePerpOrder` - テイカー注文

注文を配置し、同時に既存のメイカー注文との約定を試みます。

**特徴:**

- メイカー情報を指定して特定の注文と約定可能
- オークション期間のパーセンテージを指定可能
- 成功条件（部分約定/完全約定）を設定可能
- `postOnly`パラメータは使用不可

**用途:** 即座に約定させたい注文（テイカー側）

### 3. `placeAndMakePerpOrder` - メイカー注文

既存のテイカー注文に対してメイカーとして注文を配置し、約定させます。

**特徴:**

- テイカーの注文IDを指定して約定
- メイカー手数料を受け取れる
- IOC + PostOnly + Limit注文のみ使用可能

**用途:** 特定のテイカー注文に対して流動性を提供

### 4. `placeOrders` - 複数注文の一括配置

複数の注文を1つのトランザクションで配置します。

**特徴:**

- 最大32個の注文を一度に配置可能
- Perp/Spot両方の注文に対応
- IOC注文は使用不可

**用途:** ブラケット注文（TP/SL）など、複数注文を同時に配置

## 署名付きメッセージ注文

### 5. `placeSignedMsgTakerOrder` - 事前署名付きテイカー注文

ユーザーがオフチェーンで署名した注文を第三者が代理送信できます。

**特徴:**

- オフチェーンで注文パラメータに署名
- 第三者がトランザクション手数料を負担して送信可能
- Ed25519署名検証instructionで真正性を検証
- TP/SL注文を同時に配置可能
- スロット有効期限で期限切れを防止
- Builder手数料の組み込みが可能

**用途:** JIT流動性提供、コピートレード、ガスレス取引

### 6. `placeAndMakeSignedMsgPerpOrder` - 署名付きメッセージへのメイカー注文

署名付きメッセージのテイカー注文に対してメイカーとして流動性を提供します。

**特徴:**

- 署名付きメッセージ注文のUUIDを指定
- IOC + PostOnly + Limit注文のみ使用可能

**用途:** 署名付きメッセージ注文への即座の流動性提供

## Long/Short/TP/SL対応

すべてのメソッドで以下が可能です：

- **Long/Short**: `direction`パラメータで指定
- **Take Profit**: `OrderType::TriggerMarket`でトリガー条件を設定
- **Stop Loss**: `OrderType::TriggerMarket`でトリガー条件を設定

TP/SL注文は`reduce_only: true`で配置され、既存ポジションを超えて反対方向のポジションを持つことはありません。

## 内部実装: FillMode

これらのメソッドは内部的に`FillMode`列挙型で区別されます：

- `Fill`: 通常の約定処理（`placePerpOrder`）
- `PlaceAndMake`: メイカーとしての約定（`placeAndMakePerpOrder`）
- `PlaceAndTake(bool, u8)`: テイカーとしての約定（`placeAndTakePerpOrder`）

## Notes

- `placeOrder`という単独のメソッドは存在せず、`placePerpOrder`（Perp市場用）と`placeSpotOrder`（Spot市場用）に分かれています
- `placeAndTake`と`placeAndMake`は、コピートレードやJIT流動性提供などの高度な取引戦略で使用されます
- ブラケット注文（メイン注文 + TP + SL）は`preparePlaceAndTakePerpOrderWithAdditionalOrders`メソッドで実装できます

## コード参照

### Rust実装（programs/drift/src/lib.rs）

```rust
pub fn place_and_take_perp_order<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, PlaceAndTake<'info>>,
    params: OrderParams,
    success_condition: Option<u32>,
) -> Result<()> {
    handle_place_and_take_perp_order(ctx, params, success_condition)
}

pub fn place_and_make_perp_order<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, PlaceAndMake<'info>>,
    params: OrderParams,
    taker_order_id: u32,
) -> Result<()> {
    handle_place_and_make_perp_order(ctx, params, taker_order_id)
}

pub fn place_and_make_signed_msg_perp_order<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, PlaceAndMakeSignedMsg<'info>>,
    params: OrderParams,
    signed_msg_order_uuid: [u8; 8],
) -> Result<()> {
    handle_place_and_make_signed_msg_perp_order(ctx, params, signed_msg_order_uuid)
}

pub fn place_signed_msg_taker_order<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, PlaceSignedMsgTakerOrder<'info>>,
    signed_msg_order_params_message_bytes: Vec<u8>,
    is_delegate_signer: bool,
) -> Result<()> {
    handle_place_signed_msg_taker_order(
        ctx,
        signed_msg_order_params_message_bytes,
        is_delegate_signer,
    )
}
```

### TypeScript SDK実装（sdk/src/driftClient.ts）

```typescript
public async placePerpOrder(
    orderParams: OptionalOrderParams,
    txParams?: TxParams,
    subAccountId?: number
): Promise<TransactionSignature> {
    const { txSig, slot } = await this.sendTransaction(
        await this.buildTransaction(
            await this.getPlacePerpOrderIx(orderParams, subAccountId),
            txParams
        ),
        [],
        this.opts
    );
    this.perpMarketLastSlotCache.set(orderParams.marketIndex, slot);
    return txSig;
}

public async placeAndTakePerpOrder(
    orderParams: OptionalOrderParams,
    makerInfo?: MakerInfo | MakerInfo[],
    referrerInfo?: ReferrerInfo,
    successCondition?: PlaceAndTakeOrderSuccessCondition,
    auctionDurationPercentage?: number,
    txParams?: TxParams,
    subAccountId?: number
): Promise<TransactionSignature> {
    const { txSig, slot } = await this.sendTransaction(
        await this.buildTransaction(
            await this.getPlaceAndTakePerpOrderIx(
                orderParams,
                makerInfo,
                referrerInfo,
                successCondition,
                auctionDurationPercentage,
                subAccountId
            ),
            txParams
        ),
        [],
        this.opts
    );
    this.perpMarketLastSlotCache.set(orderParams.marketIndex, slot);
    return txSig;
}
```

## 関連リンク

- [Drift Protocol Documentation](https://docs.drift.trade/)
- [System Architecture](https://github.com/drift-labs/protocol-v2)
