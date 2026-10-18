/**
 * Tâm An Care - Dynamic Runtime Configuration
 *
 * This file is loaded synchronously before the application mounts.
 * In production container environments, it can be regenerated at startup
 * by the container entrypoint script without rebuilding static assets.
 */
window.__TAMAN_CONFIG__ = window.__TAMAN_CONFIG__ || {
  API_BASE_URL: '',
  ENABLE_DEV_SWITCHER: false,
};
