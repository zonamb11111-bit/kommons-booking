# kommons-booking セッションログ
> 更新日: 2026-05-10

---

## 1. 予約システム緊急復旧

**問題:** GAS APIが `403 Host not in allowlist` を返し、予約サイトが「Something went wrong」エラー表示  
**原因:** Google Apps Scriptのデプロイが無効化/期限切れ  
**対応:** モバイルからGASデプロイを再デプロイ（バージョン72）して復旧  
**ステータス:** 完了

---

## 2. APIエラー対策（index.html）

mainブランチにpush済み。

- API呼び出しに**自動リトライ**追加（最大3回、1s → 2s → 4s の指数バックオフ）
- **15秒タイムアウト**追加（GAS無応答時のハング防止）
- HTTPエラー検知（403/500等もリトライ対象に）
- Retryボタンを**失敗した操作だけ再試行**するよう改善（以前はページ全体リロード）
- ローカルコードをデプロイ版に同期（HIKARU TERADAブランド名、GTMタグ、新住所、Mood Curator拡張パラメータ）

---

## 3. GTMファネルトラッキング（index.html）

mainブランチにpush済み。

`track()` ヘルパー関数を追加し、予約フロー全体にdataLayerイベントを設置:

| イベント | タイミング |
|---|---|
| `select_language` | 言語選択時（en/ja） |
| `book_form_view` | ページ初期表示（流入元メニュー、言語、Mood Curator有無、source） |
| `select_menu` | メニュー確定（メニューID、件数、金額、所要時間、コンボ判定） |
| `select_date` | 日付選択 |
| `select_time` | 時間選択 |
| `submit_info` | 顧客情報入力完了 |
| `book_complete` | 予約確定（金額、メニュー、言語、流入元、トランザクションID） |
| `book_error` | 予約失敗（エラー内容） |
| `api_error` | API接続失敗（失敗箇所） |

GTMコンテナ `GTM-PL8XGR2P` には GA4 Base + 各イベントタグ + Google広告CVタグが設定済み。

---

## 4. 分析ダッシュボード（analytics-template.gs）

mainブランチにpush済み。

Google Sheetsの Apps Script で `buildDashboard()` を実行すると5シートが自動生成される:

| シート | 内容 | 使用タイミング |
|---|---|---|
| 週次ダッシュボード | PV・ユーザー・予約・売上・CVR・前週比・Ads | 毎週月曜（5分） |
| 月次分析 | 月次サマリー・広告パフォーマンス・EN比率・LINE比率 | 毎月1日（15分） |
| ファネル分析 | 各ステップ離脱率・最大離脱ステップ自動検出 | 毎週/毎月 |
| 改善ログ | 施策 → 仮説 → Before/After → 結果（ドロップダウン・自動集計） | 変更のたびに |
| KPI目標 | 月間/四半期目標・達成率・ペース判定 | 月初に目標設定 |

**未完了:** スプレッドシートへの適用が Google の権限ブロック（「このアプリはブロックされます」）で中断。スプレッドシートの「拡張機能 → Apps Script」から開き直して再試行が必要。

---

## 5. 監視スクリプト改善（monitor_booking_v2.sh）

mainブランチにpush済み。

v1 → v2 の変更点:

| 問題 | v1（旧） | v2（新） |
|---|---|---|
| Wi-Fi切断/スリープ | HTTP 000で即アラート | ネットワーク事前チェック → スキップ |
| GAS 302リダイレクト | 「ダウン」判定 | 正常扱い |
| 一時的な失敗 | 1回で即通知 | 3回連続失敗で初めて通知 |

**未完了:** Macターミナルでの適用コマンドが未実行。以下を実行する必要あり:
```bash
cp ~/.kommons/monitor_booking.sh ~/.kommons/monitor_booking.sh.bak
curl -sL https://raw.githubusercontent.com/zonamb11111-bit/kommons-booking/main/monitor_booking_v2.sh -o ~/.kommons/monitor_booking.sh
chmod +x ~/.kommons/monitor_booking.sh
echo "0" > ~/.kommons/logs/monitor_booking.failcount
```

---

## 6. hairisyoursignature.jp — NotebookLM ペイウォール問題

**問題:** NotebookLMにURLでソース追加すると「ペイウォールの背後にある」エラー  
**原因（特定済み・2つ）:**

1. **構造化データの `"isAccessibleForFree": false`** — Google/AIクローラーが「有料コンテンツ」と判定。削除 or `true` に変更が必要
2. **Cloudflare「Block AI training bots」が「Block on all pages」** — AIクローラーを全ブロック → **OFF に変更済み**

**対応状況:**
- Cloudflare側: Block AI training bots → OFF に変更 **完了**
- HTML側: `isAccessibleForFree: false` の削除 → **未完了**（`zonamb11111-bit/hairisyoursignature` リポジトリはこのセッションのスコープ外。別セッションで修正が必要）

---

## 7. 高円寺ネイバーフッドマップ

**ステータス:** 未着手

当初の目的: kommonsローンチに向けた高円寺の散策マップ（紙 + LP）。カテゴリ別スポット、バイリンガル、季節イベント、高円寺の歴史。名前は検討中。

---

## リポジトリ状態

| ブランチ | 状態 |
|---|---|
| `main` | エラー対策 + トラッキング + analytics-template.gs + monitor_v2 push済み |
| `claude/neighborhood-discovery-map-3hOfL` | 古いバージョン（mainに統合済み） |

## ファイル構成

```
kommons-booking/
├── index.html                 # 予約システム本体（リトライ + トラッキング追加済み）
├── analytics-template.gs      # 分析ダッシュボード GAS スクリプト
├── monitor_booking_v2.sh      # 改善版監視スクリプト
└── status.md                  # このファイル
```
