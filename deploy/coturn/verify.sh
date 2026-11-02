#!/usr/bin/env bash
# Read-only Coturn deployment diagnostics. Does not change firewall or services.
set -Eeuo pipefail
TURN_HOST="${TURN_HOST:-turn.smartsmanage.com}"
CERT_FILE="${CERT_FILE:-/etc/turnserver/tls/fullchain.pem}"

section() { printf '\n== %s ==\n' "$1"; }
failures=0
check() {
  local label="$1"; shift
  if "$@"; then printf '[OK] %s\n' "$label"; else printf '[FAIL] %s\n' "$label"; failures=$((failures + 1)); fi
}

section "DNS"
if command -v getent >/dev/null 2>&1 && getent ahostsv4 "$TURN_HOST"; then
  printf '[OK] %s resolves to IPv4\n' "$TURN_HOST"
else
  printf '[FAIL] %s does not resolve\n' "$TURN_HOST"; failures=$((failures + 1))
fi

section "Service and listeners"
check "Coturn service active" systemctl is-active --quiet coturn
if ss -lntup | grep -E ':(3478|5349)([[:space:]]|$)'; then
  printf '[OK] TURN/STUN listeners detected\n'
else
  printf '[FAIL] No listener on 3478/5349\n'; failures=$((failures + 1))
fi

section "TLS certificate"
if [[ -r "$CERT_FILE" ]]; then
  openssl x509 -in "$CERT_FILE" -noout -subject -issuer -dates -ext subjectAltName
  if openssl x509 -in "$CERT_FILE" -noout -checkhost "$TURN_HOST"; then
    printf '[OK] Certificate covers %s\n' "$TURN_HOST"
  else
    printf '[FAIL] Certificate SAN does not cover %s\n' "$TURN_HOST"; failures=$((failures + 1))
  fi
else
  printf '[FAIL] Certificate file is unreadable: %s\n' "$CERT_FILE"; failures=$((failures + 1))
fi

section "Firewall (read-only)"
if command -v ufw >/dev/null 2>&1; then
  ufw status numbered
else
  printf 'UFW is not installed; inspect provider firewall and host nftables/iptables separately.\n'
fi

section "TURN/TLS handshake"
if command -v timeout >/dev/null 2>&1; then
  if timeout 8 openssl s_client -connect "${TURN_HOST}:5349" -servername "$TURN_HOST" -verify_return_error </dev/null 2>&1 | tail -n 15; then
    printf 'Inspect the output above for Verify return code: 0 (ok).\n'
  else
    printf '[WARN] TLS probe did not complete; check DNS, TCP/5349 and certificate.\n'
  fi
fi

printf '\nDiagnostics finished: %s failed local checks.\n' "$failures"
exit "$(( failures > 0 ? 1 : 0 ))"
