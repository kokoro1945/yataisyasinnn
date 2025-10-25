// === メイン処理 ===
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

// === ファイルアップロード処理 ===
function uploadFile(data, column, number) {
  try {
    const folderId = '1_Qe05UN1rgc1Qielhh2pDgNYIAD-p0Cj';
    const folder = DriveApp.getFolderById(folderId);

    if (!data) throw new Error("画像データが空です");
    if (!column || !number) throw new Error("列または番号が未指定です");

    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const filename = `${column}_${number}_${timestamp}.jpg`;

    // ✅ base64データ → Blob化
    const bytes = Utilities.base64Decode(data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, 'image/jpeg', filename);

    const file = folder.createFile(blob);

    return `✅ アップロード完了: ${filename}`;
  } catch (e) {
    return `❌ サーバーエラー: ${e.message}`;
  }
}
