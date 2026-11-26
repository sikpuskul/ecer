/**
 * Utils.gs — Utilitas kriptografi, kanonikalisasi JSON, dan sanitasi.
 * Catatan keamanan: Jangan pernah mencetak PII, NIK, secret, atau PDF base64 ke Logger.
 */
function bytesToHex_(bytes) {
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i];
    if (v < 0) v += 256;
    var h = v.toString(16);
    hex.push(h.length === 1 ? '0' + h : h);
  }
  return hex.join('');
}

function sha256Hex_(input) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    input,
    Utilities.Charset.UTF_8,
  );
  return bytesToHex_(digest);
}

function hmacSha256Hex_(secret, message) {
  var sig = Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8);
  return bytesToHex_(sig);
}

function timingSafeEqualStrings_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  var maxLen = Math.max(a.length, b.length);
  var diff = a.length ^ b.length;
  for (var i = 0; i < maxLen; i++) {
    var ca = i < a.length ? a.charCodeAt(i) : 0;
    var cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

function canonicalJsonStringify_(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    var items = [];
    for (var i = 0; i < value.length; i++) {
      items.push(canonicalJsonStringify_(value[i]));
    }
    return '[' + items.join(',') + ']';
  }
  var keys = Object.keys(value)
    .filter(function (k) {
      return value[k] !== undefined;
    })
    .sort();
  var entries = [];
  for (var j = 0; j < keys.length; j++) {
    var key = keys[j];
    entries.push(JSON.stringify(key) + ':' + canonicalJsonStringify_(value[key]));
  }
  return '{' + entries.join(',') + '}';
}

function sanitizeFilename_(name) {
  var cleaned = String(name || 'dokumen.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 140);
  if (!cleaned.toLowerCase().endsWith('.pdf')) {
    cleaned += '.pdf';
  }
  return cleaned;
}

function safeLog_(event, meta) {
  var entry = Object.assign({ event: event, ts: new Date().toISOString() }, meta || {});
  console.log(JSON.stringify(entry));
}
