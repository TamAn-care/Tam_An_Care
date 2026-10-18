#!/bin/sh
set -e

CONFIG_FILE="/usr/share/nginx/html/config.js"

cat <<EOF > "$CONFIG_FILE"
/**
 * Tâm An Care - Dynamic Runtime Configuration
 * Generated automatically at container startup.
 */
window.__TAMAN_CONFIG__ = {
  API_BASE_URL: "${TAMAN_API_BASE_URL:-}",
  ENABLE_DEV_SWITCHER: ${TAMAN_ENABLE_DEV_SWITCHER:-false}
};
EOF

echo "[TamAnCare] Injected runtime configuration into $CONFIG_FILE"
