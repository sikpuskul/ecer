/**
 * Auth.gs — Verifikasi envelope HMAC-SHA256, freshness timestamp, dan anti-replay nonce.
 */
var GAS_PROTOCOL_VERSION = '1';
var MAX_REQUEST_BYTES = 512 * 1024; // 512 KiB
var TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 menit
var NONCE_TTL_SECONDS = 600; // 10 menit

var ALLOWED_ACTIONS = {
  health: true,
  inspect_template: true,
  snapshot_template: true,
  generate_document: true,
  get_generation_result: true,
  fetch_pdf: true,
  send_email: true,
  get_email_quota: true,
  delete_managed_file: true,
};

function authenticateRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return { ok: false, requestId: 'unknown', code: 'VALIDATION_ERROR', message: 'Body kosong.' };
  }

  var rawBody = String(e.postData.contents);
  if (rawBody.length > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      requestId: 'unknown',
      code: 'VALIDATION_ERROR',
      message: 'Ukuran request melebihi batas.',
    };
  }

  var envelope;
  try {
    envelope = JSON.parse(rawBody);
  } catch (err) {
    return {
      ok: false,
      requestId: 'unknown',
      code: 'VALIDATION_ERROR',
      message: 'Format JSON tidak valid.',
    };
  }

  var requestId =
    envelope && typeof envelope.requestId === 'string' ? envelope.requestId : 'unknown';

  if (envelope.version !== GAS_PROTOCOL_VERSION) {
    return {
      ok: false,
      requestId: requestId,
      code: 'UNAUTHORIZED',
      message: 'Versi protokol tidak didukung.',
    };
  }

  if (!ALLOWED_ACTIONS[envelope.action]) {
    return {
      ok: false,
      requestId: requestId,
      code: 'FORBIDDEN',
      message: 'Action tidak diizinkan.',
    };
  }

  if (
    typeof envelope.timestamp !== 'number' ||
    typeof envelope.nonce !== 'string' ||
    envelope.nonce.length < 16 ||
    typeof envelope.signature !== 'string' ||
    !envelope.payload ||
    typeof envelope.payload !== 'object'
  ) {
    return {
      ok: false,
      requestId: requestId,
      code: 'UNAUTHORIZED',
      message: 'Envelope autentikasi tidak lengkap.',
    };
  }

  var nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - envelope.timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      ok: false,
      requestId: requestId,
      code: 'UNAUTHORIZED',
      message: 'Timestamp request kedaluwarsa.',
    };
  }

  var secret = getRequiredProperty_(ECER_CONFIG_KEYS.GAS_SHARED_SECRET);
  var canonicalPayload = canonicalJsonStringify_(envelope.payload);
  var payloadHash = sha256Hex_(canonicalPayload);
  var signingContent = [
    envelope.version,
    String(envelope.timestamp),
    envelope.nonce,
    envelope.action,
    payloadHash,
  ].join('|');

  var expectedSignature = hmacSha256Hex_(secret, signingContent);
  if (!timingSafeEqualStrings_(expectedSignature, envelope.signature)) {
    return {
      ok: false,
      requestId: requestId,
      code: 'UNAUTHORIZED',
      message: 'Signature tidak valid.',
    };
  }

  // Anti-replay nonce check menggunakan CacheService
  var cache = CacheService.getScriptCache();
  var nonceKey = 'nonce_' + sha256Hex_(envelope.nonce);
  if (cache.get(nonceKey)) {
    return {
      ok: false,
      requestId: requestId,
      code: 'UNAUTHORIZED',
      message: 'Replay request terdeteksi.',
    };
  }
  cache.put(nonceKey, '1', NONCE_TTL_SECONDS);

  return {
    ok: true,
    requestId: requestId,
    action: envelope.action,
    payload: envelope.payload,
  };
}
