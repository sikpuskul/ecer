/**
 * Main.gs — Entry point Web App doPost(e) dengan action allowlist dan HMAC auth.
 */
function doPost(e) {
  var auth = authenticateRequest_(e);
  if (!auth.ok) {
    safeLog_('gas_auth_rejected', { requestId: auth.requestId, code: auth.code });
    return jsonError_(auth.requestId, auth.code, auth.message);
  }

  try {
    var data;
    switch (auth.action) {
      case 'health':
        data = {
          status: 'ok',
          environment: getAppEnv_(),
          remainingEmailQuota: MailApp.getRemainingDailyQuota(),
          timestamp: new Date().toISOString(),
        };
        break;
      case 'inspect_template':
        data = handleInspectTemplate_(auth.payload);
        break;
      case 'snapshot_template':
        data = handleSnapshotTemplate_(auth.payload);
        break;
      case 'generate_document':
        data = handleGenerateDocument_(auth.payload);
        break;
      case 'get_generation_result':
        data = handleGetGenerationResult_(auth.payload);
        break;
      case 'fetch_pdf':
        data = handleFetchPdf_(auth.payload);
        break;
      case 'send_email':
        data = handleSendEmail_(auth.payload);
        break;
      case 'get_email_quota':
        data = handleGetEmailQuota_();
        break;
      case 'delete_managed_file':
        data = handleDeleteManagedFile_(auth.payload);
        break;
      default:
        return jsonError_(auth.requestId, 'FORBIDDEN', 'Action tidak diizinkan.');
    }

    safeLog_('gas_action_ok', { requestId: auth.requestId, action: auth.action });
    return jsonSuccess_(auth.requestId, data);
  } catch (err) {
    var msg =
      err && err.message ? String(err.message) : 'INTERNAL_ERROR:Gagal memproses permintaan.';
    var sepIdx = msg.indexOf(':');
    var code = 'INTERNAL_ERROR';
    var safeMessage = 'Gagal memproses permintaan layanan dokumen.';

    if (sepIdx > 0 && /^[A-Z_]+$/.test(msg.slice(0, sepIdx))) {
      code = msg.slice(0, sepIdx);
      safeMessage = msg.slice(sepIdx + 1);
    }

    safeLog_('gas_action_error', {
      requestId: auth.requestId,
      action: auth.action,
      code: code,
    });
    return jsonError_(auth.requestId, code, safeMessage);
  }
}
