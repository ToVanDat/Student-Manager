const getAllowedOrigins = () => {
    const configuredOrigins = (process.env.FRONTEND_URLS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    const localDevelopmentOrigins = process.env.NODE_ENV === 'production'
        ? []
        : [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://student-manager.local'
        ];

    return new Set([
        ...localDevelopmentOrigins,
        process.env.FRONTEND_URL,
        ...configuredOrigins
    ].filter(Boolean));
};

const requireTrustedOrigin = (req, res, next) => {
    const originHeader = req.get('origin');
    const refererHeader = req.get('referer');

    let requestOrigin = null;

    try {
        if (originHeader) {
            requestOrigin = new URL(originHeader).origin;
        } else if (refererHeader) {
            requestOrigin = new URL(refererHeader).origin;
        }
    } catch {
        requestOrigin = null;
    }

    if (!requestOrigin || !getAllowedOrigins().has(requestOrigin)) {
        return res.status(403).json({
            message: 'Yêu cầu bị từ chối do Origin không được tin cậy'
        });
    }

    return next();
};

module.exports = requireTrustedOrigin;
