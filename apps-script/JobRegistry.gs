/**
 * JobRegistry.gs — Registri idempotensi hasil generasi dokumen berdasarkan jobId.
 */
function getJobResult_(jobId) {
  if (!jobId) return null;
  var key = 'job_' + jobId;
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveJobResult_(jobId, result) {
  var key = 'job_' + jobId;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(result));
}
