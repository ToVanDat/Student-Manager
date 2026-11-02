# Coturn deployment for Student Manager

This is a host-level Coturn deployment for a small Ubuntu VPS. It is not enabled by this repository change. Apply it only after the `turn` DNS record and TLS certificate are valid.

## 1. DNS and network prerequisites

Create the A record `turn.smartsmanage.com -> 157.10.200.241` (the VPS IPv4 previously supplied). Do not change the apex `smartsmanage.com` or `www` records if they still serve the existing AZDIGI website. If using Cloudflare, set this record to **DNS only**; ordinary HTTP proxying does not proxy TURN UDP/TCP relay traffic. Before requesting the SAN certificate, create the `app.smartsmanage.com` and `api.smartsmanage.com` A records to `157.10.200.241` as well. The temporary Nginx ACME bootstrap can serve certificate challenges before the app and API are fully deployed. Keep any apex, `www`, MX and TXT mail records unchanged.

Open these ports in both UFW and any provider firewall/security group. On the VPS, apply the following only after confirming the Coturn host is the intended service:

| Port | Protocol | Purpose |
| --- | --- | --- |
| 3478 | UDP, TCP | STUN / TURN |
| 5349 | TCP | TURN over TLS |
| 49160–49200 | UDP | Relayed media allocation range |

Apply the UFW rules without removing the current SSH/HTTP/HTTPS rules:

```bash
sudo ufw allow 3478/udp comment 'Coturn STUN TURN UDP'
sudo ufw allow 3478/tcp comment 'Coturn TURN TCP'
sudo ufw allow 5349/tcp comment 'Coturn TURN TLS'
sudo ufw allow 49160:49200/udp comment 'Coturn UDP media relay'
sudo ufw status numbered
```

Authorize the same ports in the AZDIGI VPS/provider firewall if it has a separate network firewall. Do not expose the backend API port or Coturn administration CLI. Keep the VPS's existing SSH rule unchanged.

Before installing, verify the VPS public/private interface addresses. When the VPS has the public IPv4 directly on its interface, leave `external-ip` commented out. When the server is behind NAT, set `external-ip=PUBLIC_IP/PRIVATE_IP` using the actual interface address; do not guess it.

## 2. Install and enable the service

```bash
sudo apt update
sudo apt install -y coturn
getent passwd turnserver
```

Edit `/etc/default/coturn` and set:

```ini
TURNSERVER_ENABLED=1
```

Copy `turnserver.conf.example` to `/etc/turnserver.conf`, then replace:

- `turn.smartsmanage.com` with the real TURN hostname.
- `static-auth-secret` with the exact same 64-character random hex value used by backend `TURN_SHARED_SECRET`.
- Certificate paths only after the certificate files have been installed.

Generate a secret on a trusted machine:

```bash
openssl rand -hex 32
```

Store it only in the backend's private environment file and `/etc/turnserver.conf`. Never add it to `VITE_*`, frontend build arguments, browser JavaScript, Git, chat messages, or logs.

## 2.2 Forced-relay browser acceptance test

After Coturn is reachable from the public internet and the backend has the matching `TURN_SHARED_SECRET`, deploy the frontend and open:

```text
https://app.smartsmanage.com/turn-relay-smoke.html
```

Use a short-lived access token for a test account. The page calls the authenticated `GET /api/calls/ice-config` endpoint, keeps the token only in page memory, does not print TURN credentials, and creates two local peer connections with `iceTransportPolicy: "relay"`. It exchanges SDP, opens a data channel, reads the selected candidate pair from `getStats()`, and reports PASS only when a selected pair includes a `relay` candidate and the data channel transfers its test message.

For stronger acceptance, repeat from a second device/network (for example, mobile data rather than the same Wi-Fi). The in-browser loopback test proves TURN allocation/relay transport from that browser; it does not prove real camera/microphone RTP quality or two-user signaling. Complete a real two-account audio/video call after this smoke test and inspect `chrome://webrtc-internals` on both peers. Confirm the selected candidate pair contains a `relay` candidate. Do not infer relay success from a `srflx` candidate alone.

The test page intentionally forces relay, so it fails rather than silently falling back to direct P2P. Remove or restrict this diagnostic page after deployment acceptance if it is not needed operationally.

## 2.1 Automated, guarded installation

After DNS and the Certbot certificate are valid, run the repository installer on the **VPS host** (not inside the development WSL instance). It installs Coturn, copies the certificate with restricted permissions, writes the shared-secret config, adds only the Coturn UFW allow rules when UFW is present, installs the renewal hook, and enables the service. It does not enable UFW, alter SSH rules, or configure provider firewall rules.

Read the secret without putting it in shell history, then run:

```bash
cd /opt/student-manager
read -rsp "TURN shared secret (64 hex chars): " TURN_SHARED_SECRET; echo
export TURN_SHARED_SECRET
sudo --preserve-env=TURN_SHARED_SECRET bash deploy/coturn/install.sh
unset TURN_SHARED_SECRET
```

The installer requires the existing Certbot lineage `/etc/letsencrypt/live/student-manager-smartsmanage`. It backs up an existing `/etc/turnserver.conf` before replacing it. Review the generated config and service journal after installation.

Read-only diagnostics:

```bash
sudo bash deploy/coturn/verify.sh
```

## 3. Install the certificate with restricted permissions

The expected paths are:

- `/etc/turnserver/tls/fullchain.pem`
- `/etc/turnserver/tls/privkey.pem`

Create the directory and copy the files only after Certbot has issued a certificate containing the TURN hostname:

```bash
sudo install -d -o root -g turnserver -m 0750 /etc/turnserver/tls
sudo install -o root -g turnserver -m 0640 \
  /etc/letsencrypt/live/student-manager-smartsmanage/fullchain.pem \
  /etc/turnserver/tls/fullchain.pem
sudo install -o root -g turnserver -m 0640 \
  /etc/letsencrypt/live/student-manager-smartsmanage/privkey.pem \
  /etc/turnserver/tls/privkey.pem
```

The private key is group-readable only by the Coturn service group. Do not make it world-readable and do not point Coturn at an unrestricted copy of the whole Let's Encrypt directory.

Install the repository deploy hook:

```bash
sudo install -m 0755 deploy/coturn/certbot-deploy-hook.sh \
  /etc/letsencrypt/renewal-hooks/deploy/student-manager-coturn
```

The hook refreshes the two restricted copies and restarts Coturn only when the matching certificate lineage is renewed. Verify its path and service user before relying on automatic renewal.

## 4. Configure backend TURN REST credentials

Add these settings to the backend private `.env`:

```env
STUN_URIS=stun:turn.smartsmanage.com:3478
TURN_URIS=turn:turn.smartsmanage.com:3478?transport=udp,turns:turn.smartsmanage.com:5349?transport=tcp
TURN_SHARED_SECRET=THE_SAME_64_HEX_CHAR_SECRET_AS_COTURN
TURN_CREDENTIAL_TTL_SECONDS=86400
```

The backend route `GET /api/calls/ice-config` requires the normal authenticated access token. It creates a per-user username in the Coturn REST form `expiryTimestamp:userId` and an HMAC-SHA1 credential. The default credential lifetime is 24 hours so an active call can continue authenticating allocation refreshes; shorten it only if the application enforces a matching maximum call lifetime. The service accepts TTL values from 60 to 86400 seconds. Responses are marked `Cache-Control: no-store`. The shared secret remains server-side; the browser receives only the temporary credential.

Remove any old `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`, or static TURN password from frontend build environments. A `VITE_STUN_SERVER` value may remain because STUN URLs are public configuration, not a shared secret.

## 5. Start and verify

After checking the secret equality, certificate paths, permissions, and UFW/provider firewall:

```bash
sudo systemctl enable --now coturn
sudo systemctl status coturn --no-pager
sudo journalctl -u coturn -n 100 --no-pager
sudo ss -lntup | grep -E ':(3478|5349)([[:space:]]|$)'
sudo ufw status numbered
```

The Ubuntu 24.04 (Noble) Coturn man page does not document a `--check-config` option. Validate configuration by starting/restarting the service and inspecting its exit status and journal output; do not run an undocumented check flag.

Test from two clients on different networks and inspect the browser's WebRTC ICE candidates. A successful TURN test must show a selected candidate pair using candidate type `relay`; a working signaling socket or STUN-reflexive candidate alone does not prove relay is working.

## Capacity note

The existing VPS plan was reported as approximately 1 vCPU / 1 GB RAM. This configuration uses a narrow relay range and small quotas for a low-concurrency trial, not a production capacity guarantee. TURN relays consume network bandwidth in both directions. Measure real concurrent calls, CPU, memory, packet loss, and VPS bandwidth before treating this host as production-ready.
