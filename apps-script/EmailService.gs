/**
 * EmailService.gs — Pengiriman email berlampiran PDF dan pengecekan kuota MailApp.
 */
function handleGetEmailQuota_() {
  return {
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    checkedAt: new Date().toISOString(),
  };
}

function handleSendEmail_(payload) {
  var jobId = String(payload.jobId || '').trim();
  var to = String(payload.to || '').trim();
  var subject = String(payload.subject || '').trim();
  var body = String(payload.body || '').trim();
  var driveFileId = String(payload.driveFileId || '').trim();

  if (!jobId || !to || !subject || !body || !driveFileId) {
    throw new Error('VALIDATION_ERROR:Parameter pengiriman email tidak lengkap.');
  }

  var remaining = MailApp.getRemainingDailyQuota();
  if (remaining <= 0) {
    throw new Error('EMAIL_QUOTA_EXCEEDED:Kuota email harian MailApp habis.');
  }

  var file = DriveApp.getFileById(driveFileId);
  if (!isFileInsideManagedRoot_(file)) {
    throw new Error('FORBIDDEN:Lampiran PDF tidak berada dalam folder terkelola ECER.');
  }

  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    attachments: [file.getAs(MimeType.PDF)],
  });

  return {
    jobId: jobId,
    accepted: true,
    remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    sentAt: new Date().toISOString(),
  };
}
