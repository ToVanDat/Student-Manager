// Centralized lifetime policy for authentication credentials.
// Access tokens are intentionally short-lived; refresh-token lifetime is
// enforced by the persisted expires_at value and matching HttpOnly cookie.
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

module.exports = {
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_MS
};
