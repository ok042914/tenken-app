# 消防設備点検 PWA

## セットアップ手順

### 1. Supabaseでプロジェクト作成
1. [supabase.com](https://supabase.com) にアクセスしてアカウント作成
2. 「New Project」からプロジェクトを作成
3. プロジェクト名・パスワード・リージョン（Northeast Asia推奨）を設定

### 2. スキーマとサンプルデータの投入
1. Supabaseダッシュボードの左メニューから「SQL Editor」を開く
2. `supabase_schema.sql` の内容をすべてコピー
3. SQL Editorに貼り付けて「Run」をクリック

### 3. app.js に接続情報を設定
Supabaseダッシュボードの「Project Settings」→「API」から以下を取得：

```js
// app.js の先頭部分を編集
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...（anon public key）';
```

### 4. GitHubリポジトリにpush
```bash
git init
git add .
git commit -m "初回コミット"
git remote add origin https://github.com/yourname/tenken-app.git
git push -u origin main
```

### 5. Vercelでデプロイ
1. [vercel.com](https://vercel.com) にアクセスしてログイン
2. 「New Project」→「Import Git Repository」
3. 上記のGitHubリポジトリを選択
4. フレームワークは「Other」のまま「Deploy」

### 6. 動作確認
- Vercelが発行したURLをブラウザで開く
- 工場一覧が表示されることを確認
- 点検入力→保存→再読込で結果が復元されることを確認

## バージョン情報
デプロイ日時はアプリのフッターに自動表示されます。

## 技術スタック
- フロントエンド: HTML + Vanilla JS (PWA対応)
- ホスティング: Vercel
- データベース: Supabase (PostgreSQL)
