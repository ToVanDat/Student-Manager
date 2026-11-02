# Nginx for Student Manager

The deployment uses three dedicated subdomains:

- `app.smartsmanage.com` — React/Vite static frontend.
- `api.smartsmanage.com` — Express API and Socket.IO.
- `turn.smartsmanage.com` — Coturn directly on ports 3478/5349; it is **not** reverse-proxied by Nginx.

The apex `smartsmanage.com` and `www.smartsmanage.com` are intentionally not included. Preserve their current AZDIGI records and any MX/TXT records used for email.

## DNS

After confirming the DNS provider's authoritative nameservers, create:

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| A | `app` | `157.10.200.241` | DNS only |
| A | `api` | `157.10.200.241` | DNS only |
| A | `turn` | `157.10.200.241` | DNS only |

If Cloudflare is used, all three records are safest as DNS only for this setup. In particular, TURN cannot use the ordinary orange-cloud HTTP proxy. Do not change the apex, `www`, MX, SPF, DKIM or DMARC records.

Check A and AAAA answers using a public resolver before proceeding:

```bash
sudo apt update
sudo apt install -y dnsutils
for host in app.smartsmanage.com api.smartsmanage.com turn.smartsmanage.com; do
  echo "== $host A =="; dig @1.1.1.1 +short A "$host"
  echo "== $host AAAA =="; dig @1.1.1.1 +short AAAA "$host"
done
```

Each A lookup must return `157.10.200.241`. If an AAAA record exists but the VPS is not configured for that IPv6 address, correct or remove that AAAA record before issuing the certificate. Repeat against `@8.8.8.8` if the resolvers disagree.

## Issue the certificate

Do not enable `student-manager.conf.example` before the certificate exists: its HTTPS virtual hosts reference the named certificate.

Install Nginx and Certbot if they are not already installed, then inspect the current Nginx configuration. Do not remove existing sites or overwrite unrelated domains:

```bash
sudo apt update
sudo apt install -y nginx certbot
sudo systemctl enable --now nginx
sudo nginx -T
```

Check for any existing `server_name` entries for these three subdomains and reconcile conflicts before continuing. First install the temporary bootstrap:

```bash
sudo install -d -o root -g root -m 0755 /var/www/letsencrypt/.well-known/acme-challenge
sudo install -m 0644 deploy/nginx/acme-bootstrap.conf.example /etc/nginx/sites-available/student-manager-acme
sudo ln -sfn /etc/nginx/sites-available/student-manager-acme /etc/nginx/sites-enabled/student-manager-acme
sudo nginx -t
sudo systemctl reload nginx
```

Only proceed after public DNS resolves all three names to `157.10.200.241` and inbound TCP/80 reaches this Nginx server:

```bash
sudo certbot certonly --webroot \
  --cert-name student-manager-smartsmanage \
  -w /var/www/letsencrypt \
  -d app.smartsmanage.com \
  -d api.smartsmanage.com \
  -d turn.smartsmanage.com
sudo certbot certificates
```

If issuance fails, do not install the TLS vhost or start Coturn. Fix the DNS/HTTP-01 cause first.

After issuance, remove the temporary bootstrap site and install the final site:

```bash
sudo rm -f /etc/nginx/sites-enabled/student-manager-acme
sudo install -m 0644 deploy/nginx/student-manager.conf.example /etc/nginx/sites-available/student-manager
sudo ln -sfn /etc/nginx/sites-available/student-manager /etc/nginx/sites-enabled/student-manager
sudo nginx -t
sudo systemctl reload nginx
```

## Frontend/API paths

The final vhost expects:

- Frontend build output: `/opt/student-manager/students_management-frontend/dist`.
- Backend listening on `127.0.0.1:3000`.

Build the frontend with `VITE_API_BASE_URL=https://api.smartsmanage.com`, and copy its `dist/` output into the expected directory. The API container/process must remain bound to loopback; do not publish port 3000 to the internet.

The backend private environment should include:

```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://app.smartsmanage.com
FRONTEND_URLS=https://app.smartsmanage.com
WEBAUTHN_ORIGIN=https://app.smartsmanage.com
WEBAUTHN_RP_ID=app.smartsmanage.com
WEBAUTHN_RP_NAME=Student Manager
TRUST_PROXY_HOPS=1
```

Set `TRUST_PROXY_HOPS=1` only when the API is reachable exclusively through this single trusted Nginx reverse proxy, which overwrites the forwarded headers as in the template. Do not set Express trust proxy to `true`.

The API vhost forwards only `/api/`, `/socket.io/`, `/health/` and `/`; all other paths return 404. Socket.IO uses WebSocket upgrade headers and a longer read timeout.

## Renewals and smoke checks

The Certbot deploy hook for Coturn is separate; install it using the instructions in `deploy/coturn/README.md`. Verify the app/API certificate and renewal timer:

```bash
sudo certbot renew --dry-run
sudo nginx -t
sudo systemctl status nginx --no-pager
curl -fsSI https://app.smartsmanage.com/
curl -fsS https://api.smartsmanage.com/health/ready
```

Do not treat HTTP 200 from the API health endpoint as proof that Socket.IO, database, Redis, Coturn relay, or Face Login is ready. Validate those separately.
