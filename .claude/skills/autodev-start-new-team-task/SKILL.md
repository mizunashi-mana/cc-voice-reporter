---
description: Start a new task with a Claude Code agent team. Multiple agents collaborate with distinct roles (research, design, implementation, review) to complete the task. Use when you want team-based development instead of solo work.
allowed-tools: Read, Write, Edit, MultiEdit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, TeamCreate, TeamDelete, Task, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, mcp__github__create_pull_request, mcp__github__list_pull_requests
---

# チームによる新規タスク開始

「$ARGUMENTS」をチームで進めます。

## ロール定義のベストプラクティス

公式ドキュメント（https://code.claude.com/docs/en/agent-teams）より:

- **専門性で役割を明確に分ける**: 各ロールに異なる専門領域（レンズ）を持たせ、観点の重複を避ける。単一のエージェントが1つの視点に偏る傾向を、専門分化で補う
- **チームメイトは lead の会話履歴を引き継がない**: タスク固有の詳細はスポーンプロンプトに含める（CLAUDE.md やスキルは自動で読み込まれる）
- **タスクは適切なサイズに**: 小さすぎると調整コストが上回り、大きすぎるとチェック不足になる。関数1つ、テストファイル1つなど明確な成果物が出る単位が理想
- **ファイル競合を避ける**: 同一ファイルの同時編集は上書きにつながる。各チームメイトが異なるファイルを担当する
- **進捗を監視・軌道修正する**: 放置すると無駄な作業が増える。定期的に確認し、アプローチを修正する

## ロールカタログ（例）

以下は代表的なロールの例。タスクに応じてロールを追加・変更・統合してよい。ただし reviewer の役割は常に1人以上追加すること。

各ロールは専門性によって明確に区別する。「何を見るか」「何に責任を持つか」が重複しないようにすること。

| ロール | model | mode | 専門性 |
|--------|-------|------|--------|
| **researcher** | sonnet | - | 既存コード・外部 (Web) リソース・先行事例の調査。事実・制約・選択肢を収集し、チームの意思決定に必要な情報を提供する |
| **architect** | opus | plan | 設計・方針策定。トレードオフの評価と意思決定。ユーザビリティ観点から重要な要件・受け入れ基準・品質指標を整理し、implementer と reviewer が参照する判断基準を定める |
| **implementer** | sonnet | default | architect の設計に基づくコード実装。変更の影響範囲を把握し、既存コードとの一貫性を保つ。複雑なロジックでは opus も検討 |
| **reviewer** | opus | default | コードレビュー・品質チェック。architect が定めた要件・指標を満たしているか、テストが重要な観点をカバーし不要なテストがないかを検証する。必要に応じて architect の設計にもフィードバックする |
| **tester** | sonnet | default | テスト設計・実装・動作確認。正常系・異常系・境界値を網羅し、architect の品質指標に対する検証を行う |

### モデル選択ガイドライン

- **sonnet**: 調査・実装など多くの作業のデフォルト。コスト・品質のバランスが良い
- **opus**: 設計判断（architect）、コードレビュー（reviewer）、複雑なロジックの実装など、高度な判断が必要な場合

## チーム編成の具体例

以下はあくまで参考情報。タスクの特性を分析し、その場で最適なチームを組むこと。

### 例1: 原因不明のバグ修正

> 「プロジェクト切り替え時に音声が再生されない場合がある」

**分析**: 原因の調査が中心。修正自体は小さい可能性が高い。

```
lead
├── researcher-a    ... watcher.ts 周辺の調査
├── researcher-b    ... speaker.ts 周辺の調査
├── implementer     ... 修正・テスト
└── reviewer        ... レビュー
```

- 複数の仮説を並行調査
- researcher 同士が発見を共有し合い、lead が原因を特定
- implementer が修正、reviewer がレビュー

### 例2: 新機能追加（既存パターンに沿う）

> 「多言語対応: メッセージ文字列をロケールファイルに分離」

**分析**: 設計判断が必要だが、既存コードのパターンに沿う部分が多い。

```
lead
├── researcher      ... 既存の i18n ライブラリ・パターン調査
├── implementer     ... ロケールファイル作成・コード修正
└── reviewer        ... レビュー
```

- researcher が i18n のベストプラクティスを調査
- lead が設計方針を決定、implementer が実装

### 例3: アーキテクチャ変更

> 「Speaker のキュー管理を priority queue ライブラリに置き換える」

**分析**: 既存コードへの影響が大きく、設計判断が重要。

```
lead
├── researcher      ... ライブラリ比較・既存コードの依存関係調査
├── architect       ... 移行設計・インターフェース定義
├── implementer     ... コード書き換え・テスト修正
└── reviewer        ... レビュー（特に後方互換性）
```

- researcher と architect が並行で動き、相互に情報交換
- architect は plan mode で設計を提示し、lead が承認してから実装開始

### 例4: 複数モジュールにまたがる機能追加

> 「AskUserQuestion 以外の tool_use イベントも種別ごとに読み上げ方を変える」

**分析**: parser, daemon, speaker を横断的に変更。各モジュールの変更は独立可能。

```
lead
├── researcher          ... tool_use イベントの種類を調査
├── implementer-parser  ... parser.ts の拡張
├── implementer-daemon  ... daemon.ts の対応
└── reviewer            ... レビュー
```

- ファイル間の依存に注意（parser の変更が daemon に影響する場合は順次実行）

### 例5: 小さな改善

> 「say コマンドの音声速度を設定可能にする」

**分析**: 影響範囲が小さく、設計も明確。

```
lead
├── implementer     ... 実装
└── reviewer        ... レビュー
```

- lead が Speaker クラスの現状を確認して方針を伝え、implementer が実装
- reviewer がレビュー、lead が PR 作成

## チーム構成の判断基準

パターン選択の参考にする質問:

reviewer は常に追加する。それ以外のロール追加の判断:

| 質問 | Yes の場合 |
|------|-----------|
| 原因や要件が不明確？ | researcher を追加 |
| 複数の仮説を並行調査したい？ | researcher を複数追加 |
| 設計の選択肢が複数あり判断が難しい？ | architect を追加 |
| 独立した複数モジュールを変更？ | implementer を複数追加 |
| テストや動作確認が重い？ | tester を追加 |
| 修正が小さく方針が明確？ | 最小構成（lead + implementer + reviewer） |

## コラボレーションパターン

チームメイト間のコミュニケーションの取り方。複数のパターンを組み合わせてよい。

### Hub-and-Spoke（lead 経由）

全てのコミュニケーションが lead を経由する。チーム全体の方向性を lead が把握・制御しやすい。

```
researcher ──→ lead ──→ implementer
                ↑
reviewer ───────┘
```

- 適用場面: チームメイトが少ない場合、方針のブレを防ぎたい場合
- lead が各メンバーの成果物を統合・判断してから次のメンバーに指示を出す

### Peer Discussion（直接議論）

特定のペアが直接メッセージでやり取りする。lead を介さず専門的な議論を深められる。

```
researcher ←→ architect    （調査結果と設計方針の擦り合わせ）
reviewer ←→ implementer    （レビュー指摘と修正対応）
```

- 適用場面: 専門知識を持つ役割同士で議論した方が効率的な場合
- lead には要点のみ報告し、詳細な技術議論はペア間で解決する

### Competing Hypotheses（仮説競争）

同じ役割の複数エージェントが独立して調査し、発見を突き合わせて収束させる。

```
researcher-a ──→ lead ←── researcher-b
       ↕                      ↕
  （watcher 周辺）    （speaker 周辺）
```

- 適用場面: 原因不明のバグ調査、複数の設計案を比較検討したい場合
- 各エージェントが異なる仮説を検証し、互いの発見を共有して絞り込む

### Review Loop（レビューループ）

reviewer と implementer が直接やり取りし、品質が基準を満たすまで繰り返す。

```
implementer ──実装完了──→ reviewer
    ↑                       │
    └──フィードバック対応←──┘
```

- 適用場面: 品質が重要なタスク、影響範囲が広い変更
- lead は最終確認のみ行い、技術的な改善は reviewer↔implementer 間で完結させる

### Sequential Handoff（順次引き継ぎ）

前のフェーズの成果物を次のフェーズに渡す。各フェーズが完了してから次に進む。

```
researcher ──→ architect ──→ implementer ──→ reviewer
  （調査結果）   （設計書）    （実装コード）   （レビュー結果）
```

- 適用場面: フェーズ間の依存が強い場合、手戻りを最小限にしたい場合
- 各フェーズの成果物を明確に定義し、lead が品質を確認してから次に進める

## 手順

### 1. タスクの準備

1. `$ARGUMENTS` からタスク名（英語、kebab-case）を決定
2. `.ai-agent/tasks/YYYYMMDD-{タスク名}/README.md` を作成
3. 関連ドキュメント確認:
   - `.ai-agent/steering/plan.md`
   - `.ai-agent/steering/tech.md`
   - `.ai-agent/structure.md`

### 2. チーム構成の決定

タスクの内容を分析し、最適なパターンとロールを選択する:

- タスクの規模と複雑さを評価
- 調査が必要か？設計判断が重要か？並行実装できるか？
- 上記のコラボレーションパターンから最適なものを選択
- 選択したパターンと理由をユーザーに提示し、`AskUserQuestion` で承認を得る

### 3. ブランチ作成

```bash
git checkout -b {タスク名}
```

### 4. チーム作成

```
TeamCreate({ team_name: "{タスク名}", description: "タスクの概要" })
```

### 5. タスクの作成と依存関係の設定

選択したチーム構成に基づき、`TaskCreate` でタスクを作成し、`TaskUpdate` で依存関係（`addBlockedBy`）を設定する。

タスク作成の原則:
- 各チームメイトの担当作業をタスクとして定義する
- タスク間の依存関係を明示する（前のタスクの成果物が必要なら `addBlockedBy` を設定）
- レビューは実装完了後に依存させる
- PR 作成は全タスク完了後に lead が行う

### 6. ミッションプロンプトの作成

チームメイトは lead の会話履歴を引き継がない。全メンバーが同じ目標を共有するため、共通のミッションプロンプトを作成する。

ミッションプロンプトには以下を含める:

```
## ミッション
{タスクの目的を1〜2文で}

## 背景
{なぜこのタスクが必要か、関連する Issue やユーザー要求}

## 完了条件
{何ができたら完了か、具体的な基準}

## 制約・方針
{技術的制約、設計方針、やらないことなど}

## プロジェクト情報
- steering docs: .ai-agent/steering/
- structure: .ai-agent/structure.md
- タスク README: .ai-agent/tasks/{タスクディレクトリ}/README.md
```

このミッションプロンプトは全チームメイトのスポーンプロンプトの先頭に含める。

### 7. チームメイトの起動

各チームメイトのスポーンプロンプトは「ミッションプロンプト + ロール固有の指示」で構成する。

```
{ミッションプロンプト（全員共通）}

---

## あなたの役割: {ロール名}

{ロール固有の指示}
```

#### ロール固有の指示テンプレート

**researcher**:
```
## あなたの役割: researcher
コードベースと外部リソースの調査を担当します。

TaskList で自分に割り当てられたタスクに取り組んでください。
調査結果は lead にメッセージで報告してください。
architect がチームにいる場合は、設計に関する情報を積極的に共有してください。
```

**architect**:
```
## あなたの役割: architect
設計・方針の策定を担当します。plan mode で動作します。

TaskList で自分に割り当てられたタスクに取り組んでください。
researcher の調査結果を基に設計を進め、設計方針について researcher と積極的に議論してください。

設計には以下を含めてください:
- 技術的な設計方針とトレードオフ
- ユーザビリティ観点から重要な要件・受け入れ基準
- 品質指標（何をもって十分とするか）
- implementer と reviewer が参照できる明確な判断基準

設計が固まったら lead に報告してください。
```

**implementer**:
```
## あなたの役割: implementer
コードの実装とテストを担当します。

TaskList で自分に割り当てられたタスクに取り組んでください。
実装方針に迷ったら lead に相談してください。
reviewer からフィードバックを受けたら対応してください。

実装後は以下を実行してください:
1. npm run build でコンパイルエラーがないことを確認
2. npm run lint でリンターエラーがないことを確認
3. npm test でテストが通ることを確認
```

**reviewer**:
```
## あなたの役割: reviewer
コードレビューと品質チェックを担当します。

TaskList で自分に割り当てられたタスクに取り組んでください。
レビュー結果は implementer に直接メッセージで伝えてください。
Critical な問題は lead にも報告してください。
implementer と積極的に議論して改善を進めてください。

レビュー観点:
- architect が定めた要件・受け入れ基準・品質指標を満たしているか
- 重要な観点のテストがカバーされているか、不要なテストが追加されていないか
- バグ・ロジックエラー
- セキュリティ問題
- TypeScript の型安全性
- steering docs（tech.md, structure.md）との整合性

architect の設計自体に問題や改善点があれば、architect にもフィードバックしてください。
```

### 8. ワークフローの進行

lead はタスクの依存関係に基づいてチームを進行させる。以下は進行の原則:

- **依存関係のないタスクは並行して進める**: 独立した調査や実装は同時に開始できる
- **依存関係のあるタスクは順次進める**: 前のタスクの成果物が次のタスクの入力になる場合は完了を待つ
- **コラボレーションパターンに沿って連携を促す**: 選択したパターン（Peer Discussion、Review Loop 等）に基づき、チームメイト間の直接のやり取りを促進する
- **フェーズの区切りでユーザーに確認する**: 設計方針の確定時や実装完了時など、重要な判断ポイントではユーザーに計画を提示して承認を得る
- **全タスク完了後に PR を作成する**: `autodev-create-pr` と同じ手順で PR を作成する

### 9. チームの解散

全ての作業が完了したら:

1. 各チームメイトに `shutdown_request` を送信
2. `TeamDelete` でチームをクリーンアップ
3. ユーザーに完了を報告

## 注意事項

### ファイル競合の回避
- 同一ファイルを複数エージェントが同時に編集しない
- 実装とレビューは別フェーズで順次実行する
- 並行実装の場合は、各 implementer が担当するファイルを明確に分ける

### コスト意識
- タスクの規模に見合ったチーム構成にする（小さなタスクに大きなチームは不要）
- ロールカタログのモデル選択ガイドラインに従う
- 不要になったチームメイトは早めに shutdown する

### コミュニケーション
- `broadcast` は本当に全員に伝える必要がある場合のみ使用
- 通常は `message` で特定のチームメイトに直接送る
- チームメイトが idle になるのは正常（メッセージ送信後に待機しているだけ）

### 動作確認手順

実装完了後、以下を確認:
1. `npm run build` で TypeScript コンパイルエラーがないこと
2. `npm run lint` でリンターエラーがないこと
3. `npm test` でテストが通ること
