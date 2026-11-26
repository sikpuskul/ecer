/**
 * QrService.gs — Menyisipkan gambar QR PNG base64 pada placeholder {{qr_code}}.
 */
function insertQrCodeInDoc_(doc, qrPngBase64, sizePx) {
  if (!qrPngBase64) return false;

  var bytes = Utilities.base64Decode(qrPngBase64);
  var blob = Utilities.newBlob(bytes, 'image/png', 'qr.png');
  var targetSize = sizePx || 110;
  var sections = [doc.getBody(), doc.getHeader(), doc.getFooter()];
  var inserted = false;

  for (var s = 0; s < sections.length; s++) {
    var section = sections[s];
    if (!section) continue;

    var found = section.findText('\\{\\{qr_code\\}\\}');
    while (found) {
      var element = found.getElement();
      var start = found.getStartOffset();
      var end = found.getEndOffsetInclusive();
      var textElement = element.asText();
      textElement.deleteText(start, end);

      var parent = element.getParent();
      if (parent && parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
        var img = parent.asParagraph().insertInlineImage(0, blob);
        img.setWidth(targetSize);
        img.setHeight(targetSize);
        inserted = true;
      }
      found = section.findText('\\{\\{qr_code\\}\\}');
    }
  }

  return inserted;
}
