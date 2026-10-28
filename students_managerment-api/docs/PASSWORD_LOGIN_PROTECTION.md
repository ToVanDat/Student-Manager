# Password login protection

## Scope

Password login uses two independent controls:

1. **Account + source IP progressive cooldown** to slow repeated password guessing against one account from one source.
2. **IP-only rate limit** as a network-level safety net across accounts.

There is no permanent account lockout. The account-wide risk counter is telemetry only; it is not used to deny logins, disable accounts, or lock out users. This avoids letting an attacker lock a victim out merely by submitting the victim's username.

## Progressive cooldown tiers

The account/IP failure counter has a fixed 24-hour TTL beginning with the first failure in that window. The cooldown applied after each failure is:

| Failed attempts for one account/IP pair | Cooldown |
| --- | ---: |
| 1–3 | None |
| 4–5 | 30 seconds |
| 6–7 | 1 minute |
| 8–9 | 5 minutes |
| 10–11 | 15 minutes |
| 12+ | 30 minutes |

While a cooldown is active, the login middleware returns HTTP 429 and a `Retry-After` header. Once it expires, another failed attempt increments the same 24-hour counter and applies the tier for the new count. A successful password login clears only that account/IP pair's failure and cooldown keys; it does not erase aggregate account risk telemetry.


The route checks the account/IP cooldown before consuming the IP-level limiter. Therefore repeated requests rejected by an already-active account/IP cooldown do not consume the shared IP quota; actual non-successful requests that pass the cooldown check still count toward the IP safety limit.

The account identifier and IP address are HMAC-SHA256 hashed before being used in Redis keys. The HMAC key is a dedicated secret and must not be reused from JWT or other application secrets.

## IP-level limiter

Password login also has a 30 non-successful password-login request limit per 15-minute IP window. Successful requests are decremented by `express-rate-limit`'s `skipSuccessfulRequests` behavior. This is a secondary network safety net, not the progressive per-account policy. NAT users share an egress IP, so the limit should be monitored and tuned from observed traffic rather than reduced aggressively.

The Express IP address is only trustworthy behind a proxy when `TRUST_PROXY_HOPS` matches the actual trusted proxy chain. Do not set it to `true` or `*`. When using the provided single Nginx proxy, set `TRUST_PROXY_HOPS=1` only if clients cannot bypass Nginx. Docker Compose forwards this setting into the backend container.

## Required environment

`AUTH_RATE_LIMIT_HASH_SECRET` is required and must contain at least 32 characters. Generate a dedicated random value and store it only in the ignored `.env` file. The committed `.env.example` intentionally contains an empty placeholder and is not loaded automatically by Docker Compose.

From `students_managerment-api`, copy `.env.example` to `.env` if a local `.env` does not already exist, preserve existing database settings, then set a unique secret. For Windows Command Prompt, generate a value with:

```cmd
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex') + '\\n')"
```

Paste the output as the value of `AUTH_RATE_LIMIT_HASH_SECRET` in `.env`. Do not put a real secret in `.env.example`, source code, CI logs, or commits.

Before starting the Compose stack, validate the resolved configuration:

```cmd
docker compose config --quiet
```

Compose reads `.env`, not `.env.example`. The backend container receives `AUTH_RATE_LIMIT_HASH_SECRET` through the required interpolation in `docker-compose.yml`.

## Redis behavior and recovery

The cooldown check fails closed with HTTP 503 when Redis protection state cannot be read. The IP rate-limit store also propagates Redis errors rather than silently disabling its limit. The API server currently requires Redis during startup for its broader session/socket functionality.

Password change and password reset attempt to clear all known account cooldown keys and the aggregate risk key after the database credential/session transaction commits. This cleanup is best-effort: if Redis is unavailable at that moment, the operation is not rolled back and stale cooldown keys may remain until their TTL expires. This is a known operational limitation to monitor; do not claim immediate cooldown cleanup if Redis cleanup failed.

## Operational notes

- No database schema or migration is required.
- No account-wide hard lockout is implemented.
- Account-wide risk is not currently connected to adaptive MFA, email alerts, or automated enforcement.
- Failure counters use a fixed 24-hour window from the first failure, not a sliding window.
- Keep Redis persistent/available according to the deployment's session and authentication requirements.
- Never log raw passwords, reset tokens, refresh tokens, raw IP identifiers from the protection keys, or the HMAC secret.

## Verification sequence

After implementation review is complete, run the six planned groups: cooldown tier/unit tests; Redis/Lua integration; login integration; password change/reset cleanup; IP/proxy/NAT rate-limit behavior; and auth regression (access/refresh tokens, sessions, logout, Google, Passkeys, Face Login). The existing CI workflows run the API test suite on pushes to this feature branch, but a successful CI run is not a substitute for environment-specific Redis, proxy, and auth regression verification.
