
**正式な技術仕様書 (`spec.md`)** としてまとめました。

コメント（設計上の意図・補足）も含んでいます。

---

```markdown
# 🧭 屋台部 写真アップローダーシステム 仕様書（spec.md）

---

## 🎯 ゴール

- スマートフォン上でマップを操作し、屋台（エリア＋屋台番号）を選択。  
- 選択した屋台番号に基づいて、スマホカメラで撮影した写真を Google ドライブに自動アップロードする。  
- ファイル名は `英文字+半角数字` の屋台番号を用い、同一屋台番号の2枚目以降は `_2`, `_3` … の連番を付ける。  

---

## 🧱 システム構成概要

| 要素 | 内容 |
|------|------|
| **フロントエンド** | HTML / CSS / JavaScript（スマホUI） |
| **バックエンド** | Google Apps Script（`doGet` + `uploadFile`） |
| **データストア** | Google Drive（屋台別フォルダ構造） |
| **命名規則** | `A01_YYYYMMDD_HHMMSS(_連番).jpg` |
| **動作環境** | スマホブラウザ（iOS Safari / Android Chrome） |

---

## 🗺️ 想定フロー（UX設計）

1. **トップ画面**  
   - 校内マップを表示（例：SVG / 画像マップ）。  
   - エリア（例：Aエリア / Bエリア / Cエリア）を選択。  

2. **エリア拡大画面**  
   - 選択エリア内の屋台一覧を表示。  
   - 屋台をタップして `屋台番号 (A01, A02, …)` を選択。  

3. **撮影・アップロード画面**  
   - 選択中の屋台番号を表示。  
   - 「📷 撮影する」ボタン → スマホカメラ起動。  
   - 撮影完了後、自動的に Google ドライブにアップロード。  
   - 保存ファイル名は以下のルールに従う。

---

## 📸 ファイル命名規則

```

<屋台番号>*<年月日時分秒>(*<連番>).jpg
例: A01_20251025_191030.jpg
A01_20251025_191045_2.jpg

```

### 命名仕様詳細
- 屋台番号: A〜J の英文字 + 数字1〜2桁（例：A1, B12）。
- 同一屋台番号のファイルが既に存在する場合は `_2`, `_3` … の連番を自動付与。
- 日時は JST (`Session.getScriptTimeZone()`) 基準で `yyyyMMdd_HHmmss` フォーマット。
- **コメント:** 連番チェックはドライブフォルダ内の `file.getName()` 一覧を走査して確認。

---

## ⚙️ バックエンド（GAS）仕様

### ファイル構成
```

Code.gs
index.html
map.html（今後追加予定：マップ画面）

````

---

### Code.gs 主要関数

```js
/**
 * index.html を返すエンドポイント
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

/**
 * ファイルアップロード関数
 * @param {string} data - Base64形式の画像データ
 * @param {string} boothCode - 屋台番号（例: "A01"）
 */
function uploadFile(data, boothCode) {
  try {
    const folderId = 'YOUR_FOLDER_ID_HERE'; // Google DriveフォルダID
    const folder = DriveApp.getFolderById(folderId);
    if (!data || !boothCode) throw new Error("必要なデータが不足しています。");

    // 日時文字列生成
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');

    // === 既存ファイル確認（同じ屋台番号が存在するか） ===
    const files = folder.getFilesByName(boothCode + '_' + timestamp + '.jpg');
    let count = 1;
    while (files.hasNext()) {
      count++;
    }

    // === 連番付きファイル名生成 ===
    let filename = `${boothCode}_${timestamp}`;
    if (count > 1) filename += `_${count}`;
    filename += '.jpg';

    // === Blob生成と保存 ===
    const bytes = Utilities.base64Decode(data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', filename);
    const file = folder.createFile(blob);

    return `✅ アップロード完了: ${filename}`;

  } catch (e) {
    return `❌ サーバーエラー: ${e.message}`;
  }
}
````

---

### コメント

* `boothCode`（例：A01）はマップまたは選択画面から渡す。
* 連番付与は同一タイムスタンプ・屋台番号のファイル存在チェックで実施。
* 本番運用時は `PropertiesService` にフォルダIDを持たせると安全。

---

## 🎨 フロント（index.html）概要

| 要素          | 内容                                     |
| ----------- | -------------------------------------- |
| **屋台選択エリア** | マップ画面 or セレクトボックス（暫定）                  |
| **撮影ボタン**   | `input[type=file]` + `label` でカメラを呼び出し |
| **ステータス表示** | 「📤 アップロード中…」→「✅ 完了」or「❌ エラー」          |
| **フォントサイズ** | デフォルト18px、主要UIは1.6〜2.0rem              |
| **レスポンシブ**  | スマホ幅95%（最大650px）                       |

---

### index.html 抜粋（主要部）

```html
<body>
  <header>📸 屋台部 写真アップローダー</header>

  <main>
    <h2 id="boothName">選択中: A01</h2>

    <input type="file" accept="image/*" capture="camera" id="cameraInput">
    <label for="cameraInput" class="camera-button">📷 撮影する</label>

    <p id="status"></p>
  </main>

  <footer>© 2025 屋台部 Photo Upload System</footer>

  <script>
    const input = document.getElementById('cameraInput');
    const status = document.getElementById('status');
    const booth = document.getElementById('boothName').textContent.replace('選択中: ', '');

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        status.innerText = '📤 アップロード中...';
        status.classList.add('loading');

        google.script.run
          .withSuccessHandler(msg => {
            status.innerHTML = msg;
            status.classList.remove('loading');
          })
          .withFailureHandler(err => {
            status.innerText = '❌ エラー: ' + JSON.stringify(err);
            status.classList.remove('loading');
          })
          .uploadFile(reader.result, booth);
      };
      reader.readAsDataURL(file);
    });
  </script>
</body>
```

---

## 📏 命名ロジックと拡張構想

| 機能               | 説明                                        |
| ---------------- | ----------------------------------------- |
| **連番処理**         | 同じ屋台番号のアップロードが複数ある場合 `_2`, `_3`, `_4` と付与 |
| **フォルダ分類（将来拡張）** | 屋台番号の英文字ごとにサブフォルダ分け（例：A → Aフォルダ）          |
| **スプレッドシート連携**   | 屋台番号・時刻・URL を自動記録（集計用）                    |
| **エリアマップ連動**     | map.html でSVGエリアをクリックして屋台番号を渡す            |

---

## 🧩 セキュリティ・デプロイ設定

| 項目     | 設定値                      | 備考                 |
| ------ | ------------------------ | ------------------ |
| デプロイ種別 | ウェブアプリ                   | Apps Script標準      |
| 実行ユーザー | 自分として実行                  | Drive書き込み権限を持つ必要あり |
| アクセス権  | 全員（匿名含む）または学内アカウント限定     | 運用ポリシーに応じて選択       |
| フォルダ権限 | Driveでスクリプト所有者が編集権限を持つこと |                    |

---

## 🧪 テスト項目

| テストケース           | 期待結果                     |
| ---------------- | ------------------------ |
| 撮影→アップロード（正常）    | ファイルが指定フォルダに保存され、名前が規則通り |
| 同一屋台連続撮影         | `_2`, `_3` が正しく付く        |
| 屋台番号未選択          | エラー表示「屋台番号を選択してください」     |
| ネットワーク切断         | エラー表示後に再送可能              |
| 他端末（iOS/Android） | 両方でカメラが正常起動すること          |

---

## 🧾 今後の拡張（design.md 対応）

| 機能          | 概要                                       |
| ----------- | ---------------------------------------- |
| **マップUI**   | SVGマップまたはCanvasでエリア選択を実装（`map.html`）     |
| **エリア拡大**   | 選択エリアを拡大し屋台一覧を表示                         |
| **屋台選択**    | 屋台タップで `boothCode` を確定し `index.html` に渡す |
| **アニメーション** | マップ移動時のフェード/ズーム演出                        |
| **フォルダ分類**  | Drive上で `Aフォルダ/A01.jpg` のように階層化          |

---

## ✅ 実装チェックリスト

* [ ] `folderId` が本番環境の保存先を指している
* [ ] `doGet` が `index.html` を正しく返す
* [ ] `uploadFile` に引数・バリデーション・例外処理がある
* [ ] 命名規則が `英文字数字_時刻_連番` 形式で運用される
* [ ] 実機テストでアップロードが確認できる
* [ ] ウェブアプリ設定（実行者/アクセス権）が正しい

---

## 📚 備考

* Base64データ転送のため、写真が5MBを超えると通信が遅くなる。必要に応じてリサイズ処理を追加可能。
* 同一屋台番号での重複名回避は、Drive上でファイル名の存在チェックを行う。
* マップ選択UI導入時には、`boothCode` を `google.script.run.uploadFile()` に引き渡すよう変更。

---

## ✍️ 更新履歴

| 日付         | 更新内容                        |
| ---------- | --------------------------- |
| 2025-10-25 | 初版作成（GAS＋HTML構成）            |
| 2025-10-26 | 仕様強化：マップUI構想・命名規則連番対応を追記    |
| 今後         | design.md 連携（UI設計・画面遷移定義）予定 |

---

© 2025 屋台部 技術チーム

```

---

この `.md` ファイルを `spec.md` として保存すれば、  
開発メンバー間で **設計書兼運用仕様書** として使えます。  

---

💡 次に行うと良いステップ：
- `design.md` に「マップUI（SVG構成・エリア→屋台）」の設計を落とし込む  
- それを基に `map.html` を実装  

希望があれば、`design.md` の雛形（マップ画面構成＋画面遷移定義）もすぐ出します。  
つくりたいですか？
```
