/**
 * HTML Service entry point for the photo upload web app.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

/**
 * GAS HTML Service entry point (google.script.run 経由).
 * フロントからのアップロード要求を処理して完了メッセージを返す。
 */
function uploadFile(data, boothCode) {
  try {
    // メッセージはフロントのステータス表示にそのまま載せる想定
    var filename = saveImageToDrive_(data, boothCode);
    return 'アップロード完了: ' + filename;
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
}

/**
 * 外部クライアント (fetch) からの CORS リクエストにも対応。
 */
function doPost(e) {
  try {
    // 外部クライアントからの JSON body を取り出す
    var payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var filename = saveImageToDrive_(payload.data, payload.boothCode);
    var body = JSON.stringify({
      success: true,
      message: 'アップロード完了: ' + filename
    });
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    console.error(error);
    var errorBody = JSON.stringify({
      success: false,
      message: error.message || '予期しないエラーが発生しました。'
    });
    return ContentService.createTextOutput(errorBody).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 実際の保存処理。本体ロジックを集約し、成功時はファイル名を返す。
 *
 * @param {string} data      Base64 DataURL string
 * @param {string} boothCode Booth identifier (e.g. "A01")
 * @return {string} 保存されたファイル名
 */
function saveImageToDrive_(data, boothCode) {
  var folderId = '1_Qe05UN1rgc1Qielhh2pDgNYIAD-p0Cj'; // TODO: Script Properties への移行を検討

  if (!data || typeof data !== 'string') {
    throw new Error('画像データが取得できませんでした。');
  }
  if (!boothCode || typeof boothCode !== 'string') {
    throw new Error('屋台番号が送信されていません。');
  }

  var normalizedBoothCode = boothCode.trim().toUpperCase();
  if (!/^[A-J]\d{2}$/.test(normalizedBoothCode)) {
    throw new Error('屋台番号の形式が不正です。例: A01');
  }

  var parts = data.split(',');
  if (parts.length < 2 || !parts[1]) {
    throw new Error('画像データ形式が不正です。');
  }
  var base64Body = parts[1];

  var folder = DriveApp.getFolderById(folderId);
  // 命名規則: A01_YYYYMMDD_HHmmss(_n).jpg
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var baseName = normalizedBoothCode + '_' + timestamp;
  var pattern = new RegExp('^' + baseName + '(?:_(\\d+))?\\.jpg$');

  // 既存ファイルを走査し、最大の連番を取得する
  var maxIndex = 0;
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var match = file.getName().match(pattern);
    if (match) {
      var index = match[1] ? parseInt(match[1], 10) : 1;
      if (index > maxIndex) {
        maxIndex = index;
      }
    }
  }

  var suffix = maxIndex >= 1 ? '_' + (maxIndex + 1) : '';
  var filename = baseName + suffix + '.jpg';

  var bytes = Utilities.base64Decode(base64Body);
  var blob = Utilities.newBlob(bytes, 'image/jpeg', filename);
  // ここで Drive に保存。戻り値は使用せず、例外発生のみ検知する
  folder.createFile(blob);

  return filename;
}
