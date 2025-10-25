/**
 * Entry point for the photo upload web app.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

/**
 * Saves the captured image to Google Drive using the booth code naming convention.
 *
 * @param {string} data      Base64 DataURL string (image/jpeg)
 * @param {string} boothCode Booth identifier (e.g. "A01")
 * @return {string} Result message for the frontend.
 */
function uploadFile(data, boothCode) {
  try {
    var folderId = '1_Qe05UN1rgc1Qielhh2pDgNYIAD-p0Cj';
    var folder = DriveApp.getFolderById(folderId);

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

    var now = new Date();
    var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    var baseName = normalizedBoothCode + '_' + timestamp;
    var namePattern = new RegExp('^' + baseName + '(?:_(\\d+))?\\.jpg$');

    var maxIndex = 0;
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var match = file.getName().match(namePattern);
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
    folder.createFile(blob);

    return 'アップロード完了: ' + filename;
  } catch (error) {
    console.error(error);
    return 'サーバーエラー: ' + error.message;
  }
}
