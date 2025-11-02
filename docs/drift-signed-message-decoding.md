# Drift SDK 署名付きメッセージデコードガイド

## 概要

Drift SDKの署名付きメッセージデコード機能は、手動での複雑な変換処理を不要にする便利関数を提供しています。`decodeSignedMsgOrderParamsMessage`メソッドが内部的にdiscriminator除去、128バイトパディング追加、IDLバージョン互換性処理を自動的に行い、hex文字列からのBuffer変換とデコードの2行で完了します。

## 実装方法

### シンプルな2行のデコード

```typescript
// 1. hex文字列からBufferへ変換
const signedMsgOrderParamsBuf = Buffer.from(messageHexString, "hex");

// 2. SDKメソッドでデコード（discriminator除去とパディングは自動）
const decodedMessage = driftClient.decodeSignedMsgOrderParamsMessage(
  signedMsgOrderParamsBuf,
  isDelegateSigner
);
```

### Instruction Data構造

`placeSignedMsgTakerOrder`のinstruction dataは以下の構造を持ちます：

```
- 0-7:      instruction discriminator (8 bytes)
- 8-11:     Vec<u8> length (u32, 4 bytes)
- 12-75:    signature (64 bytes)
- 76-107:   signing_authority (32 bytes)
- 108-109:  message_length (u16, 2 bytes)
- 110以降:  message (hex文字列としてエンコードされたSignedMsgOrderParamsMessage)
- 最後:     isDelegateSigner (bool, 1 byte)
```

### 完全な実装例

```typescript
function decodeSignedMsgOrder(ixData: Buffer): void {
  const discriminator = ixData.slice(0, 8);
  const expectedDiscriminator = Buffer.from([0x20, 0x4f, 0x65, 0x8b, 0x19, 0x06, 0x62, 0x0f]);
  
  if (!discriminator.equals(expectedDiscriminator)) {
    return;
  }

  const dataAfterDiscriminator = ixData.slice(8);
  const vecLength = dataAfterDiscriminator.readUInt32LE(0);

  // signature(64) + signing_authority(32) + message_length(2) + message(hex文字列)
  const signature = dataAfterDiscriminator.slice(4, 68);
  const signingAuthority = dataAfterDiscriminator.slice(68, 100);
  const messageLengthRaw = dataAfterDiscriminator.readUInt16LE(100);
  const messageHexString = dataAfterDiscriminator.slice(102, 102 + messageLengthRaw).toString("ascii");

  // isDelegateSignerはVec<u8>の後（1バイト）
  const isDelegateSignerIndex = 4 + vecLength;
  const isDelegateSigner = dataAfterDiscriminator.readUInt8(isDelegateSignerIndex) === 1;

  // SDKの便利関数を使用したシンプルなデコード（2行で完了）
  const signedMsgOrderParamsBuf = Buffer.from(messageHexString, "hex");
  const decodedMessage = driftClient.decodeSignedMsgOrderParamsMessage(
    signedMsgOrderParamsBuf,
    isDelegateSigner
  );

  console.log(JSON.stringify(decodedMessage, null, 2));
}
```

## SDKの内部実装

### 1. decodeSignedMsgOrderParamsMessageメソッド

**ファイル:** `sdk/src/driftClient.ts:6995`

```typescript
public decodeSignedMsgOrderParamsMessage(
  encodedMessage: Buffer,
  delegateSigner?: boolean
): SignedMsgOrderParamsMessage | SignedMsgOrderParamsDelegateMessage {
  const decodeStr = delegateSigner 
    ? 'SignedMsgOrderParamsDelegateMessage' 
    : 'SignedMsgOrderParamsMessage';
  
  return this.program.coder.types.decode(
    decodeStr,
    Buffer.concat([
      encodedMessage.slice(8),  // discriminator除去
      Buffer.alloc(128),        // 128バイトのパディング追加
    ])
  );
}
```

### 2. SDKが自動的に行う処理

1. **Discriminator除去**: メッセージの最初の8バイト（discriminator）を自動的に除去
2. **パディング追加**: メッセージが小さい場合、128バイトのパディングを追加
3. **IDLバージョン互換性**: 異なるIDLバージョン間での互換性を保証

### 3. プロダクションコードでの使用例

**ファイル:** `sdk/src/orderSubscriber/swiftOrderSubscriber.ts:191-204`

```typescript
// hex文字列からBufferへ変換
const signedMsgOrderParamsBuf = Buffer.from(
  order.order_message,
  'hex'
);

// SDKメソッドでデコード
const signedMessage = this.driftClient.decodeSignedMsgOrderParamsMessage(
  signedMsgOrderParamsBuf,
  isDelegateSigner
);
```

## オンチェーンでの実装

### Rustでの検証・デコード処理

**ファイル:** `programs/drift/src/math/sig_verification.rs:70-114`

```rust
pub fn deserialize_into_verified_message(
    payload: Vec<u8>,
    signature: &[u8; 64],
    is_delegate_signer: bool,
) -> Result<VerifiedMessage> {
    let mut owned = payload;
    let min_len = 128 + 8; // message + discriminator

    // 自動パディング処理
    if owned.len() < min_len {
        owned.resize(min_len, 0);
    }

    // discriminator除去してデシリアライズ
    let deserialized = SignedMsgOrderParamsMessage::deserialize(
        &mut &owned[8..], // 8 byte manual discriminator
    )?;

    // 署名検証
    verify_signed_msg_order_params_message(
        &owned,
        signature,
        is_delegate_signer,
        &deserialized,
    )?;

    Ok(VerifiedMessage {
        message: deserialized,
        signature: *signature,
    })
}
```

### オンチェーンとSDKの共通点

1. **Discriminator除去**: 両方とも最初の8バイトを除去してからデシリアライズ
2. **自動パディング**: メッセージが小さい場合、自動的にパディングを追加
3. **堅牢性**: サイズチェックとエラーハンドリングを実装

## デコード結果の例

```json
{
  "signedMsgOrderParams": {
    "orderType": { "limit": {} },
    "marketType": { "perp": {} },
    "direction": { "long": {} },
    "userOrderId": 2,
    "baseAssetAmount": "09502f9000",
    "price": "17513d00",
    "marketIndex": 79,
    "reduceOnly": false,
    "postOnly": { "none": {} },
    "bitFlags": 0
  },
  "subAccountId": 0,
  "slot": "167e97b0",
  "uuid": [65, 72, 107, 90, 108, 77, 112, 101]
}
```

## まとめ

- **シンプル**: わずか2行でデコードが完了
- **自動処理**: discriminator除去とパディング追加を自動実行
- **堅牢**: オンチェーンと同じロジックで動作
- **プロダクション実績**: Swift Order Subscriberなどで実際に使用されている

Drift SDKの`decodeSignedMsgOrderParamsMessage`メソッドを使用することで、複雑な手動処理を避け、安全で保守性の高いコードを実装できます。
