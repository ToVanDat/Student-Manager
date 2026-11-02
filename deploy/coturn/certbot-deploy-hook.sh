#!/usr/bin/env bash
set -euo pipefail

EXPECTED_LINEAGE="/etc/letsencrypt/live/student-manager-smartsmanage"
TARGET_DIR="/etc/turnserver/tls"

if [[ "${RENEWED_LINEAGE:-}" != "$EXPECTED_LINEAGE" ]]; then
    exit 0
fi

if ! id turnserver >/dev/null 2>&1; then
    echo "Coturn service account 'turnserver' does not exist; refusing certificate install." >&2
    exit 1
fi

install -d -o root -g turnserver -m 0750 "$TARGET_DIR"
install -o root -g turnserver -m 0640 "$RENEWED_LINEAGE/fullchain.pem" "$TARGET_DIR/fullchain.pem"
install -o root -g turnserver -m 0640 "$RENEWED_LINEAGE/privkey.pem" "$TARGET_DIR/privkey.pem"

if systemctl is-active --quiet coturn; then
    systemctl restart coturn
fi
