#!/usr/bin/env bash
# Idempotent host-level Coturn setup. Run only on the target Ubuntu VPS after
# DNS points turn.smartsmanage.com to this host and Certbot has issued the cert.
set -Eeuo pipefail
umask 077

TURN_HOST="turn.smartsmanage.com"
CERT_LINEAGE="/etc/letsencrypt/live/student-manager-smartsmanage"
TLS_DIR="/etc/turnserver/tls"
CONFIG="/etc/turnserver.conf"
DEFAULTS="/etc/default/coturn"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXAMPLE="${REPO_ROOT}/deploy/coturn/turnserver.conf.example"
HOOK="${REPO_ROOT}/deploy/coturn/certbot-deploy-hook.sh"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || fail "Run with sudo/root on the Ubuntu VPS."
[[ -r "$EXAMPLE" ]] || fail "Missing template: $EXAMPLE"
[[ -r "$CERT_LINEAGE/fullchain.pem" && -r "$CERT_LINEAGE/privkey.pem" ]] || fail "TLS certificate is missing. Issue the Certbot certificate before installing Coturn."
openssl x509 -in "$CERT_LINEAGE/fullchain.pem" -noout -checkhost "$TURN_HOST" >/dev/null || fail "The installed certificate does not cover $TURN_HOST."
[[ -n "${TURN_SHARED_SECRET:-}" ]] || fail "Export TURN_SHARED_SECRET for this process; do not put it in this script."
[[ "$TURN_SHARED_SECRET" =~ ^[a-fA-F0-9]{64}$ ]] || fail "TURN_SHARED_SECRET must be exactly 64 hexadecimal characters."

if ! getent ahostsv4 "$TURN_HOST" >/dev/null; then
  fail "$TURN_HOST does not resolve via system DNS. Fix DNS before installation."
fi

. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || fail "This installer currently supports Ubuntu only."

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y coturn
getent passwd turnserver >/dev/null || fail "Package did not create the turnserver service account."

# Keep an existing config recoverable; never silently overwrite it.
if [[ -e "$CONFIG" ]]; then
  backup="${CONFIG}.backup.$(date -u +%Y%m%dT%H%M%SZ)"
  cp -a "$CONFIG" "$backup"
  printf 'Existing config backed up to %s\n' "$backup"
fi

install -d -o root -g turnserver -m 0750 "$TLS_DIR"
install -o root -g turnserver -m 0640 "$CERT_LINEAGE/fullchain.pem" "$TLS_DIR/fullchain.pem"
install -o root -g turnserver -m 0640 "$CERT_LINEAGE/privkey.pem" "$TLS_DIR/privkey.pem"

# The secret is hex-only, so it is safe to substitute as a single config token.
sed "s/REPLACE_WITH_THE_SAME_64_HEX_CHAR_BACKEND_TURN_SHARED_SECRET/$TURN_SHARED_SECRET/" "$EXAMPLE" > "$CONFIG.tmp"
if grep -q 'REPLACE_WITH_THE_SAME_64_HEX_CHAR_BACKEND_TURN_SHARED_SECRET' "$CONFIG.tmp"; then
  rm -f "$CONFIG.tmp"
  fail "TURN secret placeholder substitution failed."
fi
install -o root -g root -m 0640 "$CONFIG.tmp" "$CONFIG"
rm -f "$CONFIG.tmp"

if [[ -f "$DEFAULTS" ]]; then
  if grep -qE '^TURNSERVER_ENABLED=' "$DEFAULTS"; then
    sed -i 's/^TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' "$DEFAULTS"
  else
    printf '\nTURNSERVER_ENABLED=1\n' >> "$DEFAULTS"
  fi
else
  printf 'TURNSERVER_ENABLED=1\n' > "$DEFAULTS"
fi
chmod 0644 "$DEFAULTS"

# Add only Coturn rules. Do not enable UFW or modify existing SSH rules here.
if command -v ufw >/dev/null 2>&1; then
  ufw allow 3478/udp comment 'Coturn STUN TURN UDP'
  ufw allow 3478/tcp comment 'Coturn TURN TCP'
  ufw allow 5349/tcp comment 'Coturn TURN TLS'
  ufw allow 49160:49200/udp comment 'Coturn UDP media relay'
else
  printf 'NOTICE: UFW is not installed; configure equivalent rules in the host/provider firewall.\n'
fi

install -D -o root -g root -m 0755 "$HOOK" /etc/letsencrypt/renewal-hooks/deploy/student-manager-coturn
systemctl enable coturn
systemctl restart coturn
systemctl --no-pager --full status coturn
ss -lntup | grep -E ':(3478|5349)([[:space:]]|$)' || true
printf '\nCoturn setup complete. Confirm UDP relay range in provider firewall and verify relay from external clients.\n'
