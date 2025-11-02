# d3k Command

dev3000(a.k.a. d3k)のMCPツールを使用して、フロントエンドのdebugを効率的に行ってください。

## Steps
1. 以下のtoolを適切に使用し、現在d3kで起動中のフロントエンドアプリにwarning, errorがないかを確認してください。
2. stacktraceからerror箇所のファイルを読み込み、そのerrorの根本原因を特定してください。
3. どうしても原因特定ができない場合、もし原因特定に必要な情報が不足している場合は、開発者に伝えてください。
4. その後その原因を確実に解決するminimumかつ効果的な手段を検討してください。
5. その手段を実行してください。
6. lint, format, build, testがあれば実行し、全てのtestが成功することを確認してください。
7. testがfailした場合そのerrorについてまた1からやり直してください。


## Tool
以下がこのMCPハンドラでdev3000から利用できるツール一覧と詳細です。

### get_current_timestamp
- **説明**: 現在時刻をISO形式で返します（テスト前後の時刻マーカー用）。
- **パラメータ**: なし
- **返却**: text（例: `Current timestamp: 2025-09-13T05:12:34.567Z`）
- **補足**: 取得した時刻は後続の `get_logs_between_timestamps` に渡して区間ログ抽出に使用。

### healthcheck
- **説明**: MCPサーバのヘルスチェック。通常は不要（接続できていれば十分）。
- **パラメータ**
  - **message**: string（任意）— エコーバック用メッセージ
- **返却**: text（例: `✅ MCP server is healthy! - Timestamp: ...`）

### read_consolidated_logs
- **説明**: 統合ログ（サーバ出力/ブラウザ/ネットワーク/操作/スクショ）の最近の行を取得。フィルタ文字列で絞り込み可能。
- **パラメータ**
  - **lines**: number（任意, 既定: 50）— 末尾からの取得行数
  - **filter**: string（任意）— 文字列一致で行フィルタ（case-insensitive）
  - **logPath**: string（任意, 既定: `process.env.LOG_FILE_PATH || "./ai-dev-tools/consolidated.log"`）
- **返却**: text（見つかった行を結合、該当なしならその旨）
- **注意**: ログファイルが存在しない場合はメッセージで通知。

### search_logs
- **説明**: 正規表現でログを検索し、ヒット周辺のコンテキスト行も含めて返す。エラー原因や操作とエラーの相関追跡に有用。
- **パラメータ**
  - **pattern**: string（必須）— 検索用正規表現
  - **context**: number（任意, 既定: 2）— 前後に付与する行数
  - **logPath**: string（任意, 既定: 上記と同じ）
- **返却**: text（ヒットごとに「Match at line N: ...」形式）
- **注意**: ファイル未検出時は通知。大文字小文字は `gi` で無視。

### get_logs_between_timestamps
- **説明**: 2つのISO時刻の間にあるログのみ抽出。テスト前後に取得した時刻を使った区間分析の要。
- **パラメータ**
  - **startTime**: string（必須, ISO 8601）
  - **endTime**: string（必須, ISO 8601）
  - **filter**: string（任意）— 文字列一致でさらに絞り込み
  - **logPath**: string（任意, 既定: 上記と同じ）
- **返却**: text（件数サマリ＋該当行、該当なしならサマリのみ）
- **注意**: 行内に `[YYYY-MM-DDTHH:MM:SS.mmmZ]` 形式のタイムスタンプがある行のみ対象。start < end が必須。

### get_browser_errors
- **説明**: 直近のブラウザ系エラー（Console Error/Page Errorなど）を抽出。[BROWSER] タグかつ ERROR/CONSOLE ERROR/PAGE ERROR を含む行のみ。
- **パラメータ**
  - **hours**: number（任意, 既定: 1）— 何時間遡るか
  - **logPath**: string（任意, 既定: 上記と同じ）
- **返却**: text（条件に合致した行、なければその旨）
- **注意**: 行内タイムスタンプがあれば時刻で絞り込み。なければ行は残す方針。

### execute_browser_action
- **説明**: CDP経由で安全なブラウザ操作を実行（クリック/ナビゲート/スクショ/式評価/スクロール/タイプ）。操作はログにも記録されます。
- **パラメータ**
  - **action**: `"click" | "navigate" | "screenshot" | "evaluate" | "scroll" | "type"`（必須）
  - **params**: object（任意, アクションに応じて必須項目あり）
    - **x**: number（任意）— クリック/スクロール座標X（click/scroll向け）
    - **y**: number（任意）— クリック/スクロール座標Y（click/scroll向け）
    - **url**: string（任意）— 遷移先URL（navigate向け、`http/https`のみ許可）
    - **selector**: string（任意）— 目標要素のCSSセレクタ（現状は直接CDP入力で未使用）
    - **text**: string（任意）— 入力文字列（type向け）
    - **expression**: string（任意）— 評価式（evaluate向け、下記ホワイトリストのみ）
    - **deltaX**: number（任意）— スクロールX量（scroll向け）
    - **deltaY**: number（任意）— スクロールY量（scroll向け）
- **制約/バリデーション**
  - click: `x` と `y` 必須
  - navigate: `url` 必須、`http://` or `https://` のみ
  - screenshot: 追加パラメータ不要（`Page.captureScreenshot`）
  - evaluate: `expression` 必須、以下の正規表現にマッチする安全な読み取り専用式のみ
    - `document.title`
    - `window.location.href`
    - `document.querySelector('...').textContent`
    - `document.body.scrollHeight`
    - `window.scrollY`
    - `window.scrollX`
  - scroll: `deltaX/deltaY` 任意（座標は省略時 500/500）
  - type: `text` 必須（1文字ずつ送信）
  - CDPコマンドは5秒タイムアウト
- **前提**: `http://localhost:9222/json` に接続できるCDPターゲット（dev3000のCDP監視が有効）が必要
- **返却**: text（結果オブジェクトをJSON化して返却。エラー時はメッセージ）

- **共通設定（サーバ）**: `basePath: "/api/mcp"`, `maxDuration: 60`, `verboseLogs: true`
- **既定ログパス**: `process.env.LOG_FILE_PATH || "/tmp/d3k.log"`
