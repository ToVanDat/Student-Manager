# Local Nginx reverse proxy

The example `student-manager.local.conf.example` is a reference configuration;
it is not installed or enabled automatically.

## Assumptions

- Nginx is the single reverse proxy directly in front of Express.
- Nginx and the API can both reach `127.0.0.1:3000`.
- Vite is reachable at `127.0.0.1:5173`.
- The TLS certificate and key exist at the paths in the example.
- The backend port is not exposed to untrusted networks around the proxy.

The sample overwrites `X-Forwarded-For` with `$remote_addr`. Do not replace
that with `$proxy_add_x_forwarded_for` unless you have separately configured
and verified every upstream proxy in the chain.

## Express proxy trust

Only after the assumptions above are true, set this in the backend environment:

```env
TRUST_PROXY_HOPS=1
```

This makes Express trust exactly one proxy hop. Do not set it to `true` or
`*`. If another load balancer/CDN is inserted, recalculate the hop count and
restrict which networks can reach the backend before changing this value.

Leave `TRUST_PROXY_HOPS` empty when accessing Express directly during local
development. If clients can bypass Nginx and connect directly to the API while
the setting is enabled, they may be able to spoof forwarded IP headers.

## Apply manually

1. Create the certificate and key; do not use placeholder certificate paths.
2. Copy the example to `/etc/nginx/sites-available/student-manager.local`.
3. Enable the site, then run `sudo nginx -t`.
4. Reload Nginx only if the syntax check succeeds.
5. Start the API and Vite on the expected ports.
6. Set `TRUST_PROXY_HOPS=1` only after confirming the API is reachable only
   through this Nginx instance; restart the API afterward.

No live Nginx configuration, certificate, firewall, or host file is modified by
this repository example.
