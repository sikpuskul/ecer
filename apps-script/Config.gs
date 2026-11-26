/**
 * Config.gs — Membaca Script Properties secara aman tanpa hardcode secret.
 */
var ECER_CONFIG_KEYS = {
  GAS_SHARED_SECRET: 'GAS_SHARED_SECRET',
  APP_BASE_URL: 'APP_BASE_URL',
  APP_ENV: 'APP_ENV',
  DRIVE_ROOT_FOLDER_ID: 'DRIVE_ROOT_FOLDER_ID',
  TEMPLATE_SNAPSHOT_FOLDER_ID: 'TEMPLATE_SNAPSHOT_FOLDER_ID',
  TEMP_FOLDER_ID: 'TEMP_FOLDER_ID',
  JOB_REGISTRY_ID: 'JOB_REGISTRY_ID',
};

function getRequiredProperty_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value || !String(value).trim()) {
    throw new Error('Missing Script Property: ' + key);
  }
  return String(value).trim();
}

function getOptionalProperty_(key, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value).trim();
}

function getAppEnv_() {
  return getOptionalProperty_(ECER_CONFIG_KEYS.APP_ENV, 'staging');
}
