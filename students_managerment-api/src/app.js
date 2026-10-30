// Ensure environment variables are available before routers and middleware are initialized.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const studentRouter = require('../router/studentRouter');
const classerRouter = require('../router/classerRouter');
const departmentRouter = require('../router/departmentRouter');
const enrollmentRouter = require('../router/enrollmentRouter');
const semesterRouter = require('../router/semestersRouter');
const subjectRouter = require('../router/subjectRouter');
const authRouter = require('../router/authRouter');
const sessionRouter = require('../router/sessionRouter.js');
const conversationRouter = require('../router/conversationRouter');
const messageRouter = require('../router/messageRouter');
const userRouter = require('../router/userRouter');
const permissionRouter = require('../router/permissionRouter');
const messageFileRouter = require('../router/messageFileRouter');
const callRouter = require('../router/callRouter');
const webPushRouter = require('../router/webPushRouter');
const e2eeRouter = require('../router/e2eeRouter');
const e2eeRelayRouter = require('../router/e2eeRelayRouter');
const chatbotRouter = require('../router/chatbotRouter');
const healthRouter = require('../router/healthRouter');

const app = express();

// Trust only an explicitly configured number of reverse-proxy hops.
// Leave unset for direct/local development. Never use blanket "true".
const trustProxyHops = process.env.TRUST_PROXY_HOPS;
if (trustProxyHops !== undefined && trustProxyHops !== '') {
    if (!/^[1-9][0-9]*$/.test(trustProxyHops)) {
        throw new Error('TRUST_PROXY_HOPS must be a positive integer');
    }

    app.set('trust proxy', Number(trustProxyHops));
}

app.disable('x-powered-by');

// Baseline security headers. TLS/HSTS belongs to the reverse proxy.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
    next();
});

// Explicit allowlist supports both Vite HTTP and local Nginx HTTPS.
// Do not use wildcard origins with credentialed requests.
const configuredOrigins = (process.env.FRONTEND_URLS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const localDevelopmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];

const allowedOrigins = new Set([
    ...localDevelopmentOrigins,
    process.env.FRONTEND_URL,
    ...configuredOrigins,
].filter(Boolean));

app.use(express.json({ limit: '1mb' }));
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
}));
app.use(cookieParser());

app.use('/health', healthRouter);

app.get('/', (req, res) => {
    res.json({ message: 'Student Management API is running' });
});

app.use('/api/students', studentRouter);
app.use('/api/classes', classerRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/enrollments', enrollmentRouter);
app.use('/api/semesters', semesterRouter);
app.use('/api/subjects', subjectRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth/sessions', sessionRouter);
app.use('/api/notifications', webPushRouter);
app.use('/api/e2ee', e2eeRouter);
app.use('/api/e2ee/relay', e2eeRelayRouter);
app.use('/api/assistant', chatbotRouter);
app.use('/api/users', userRouter);
app.use('/api/permissions', permissionRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/messages', messageRouter);
app.use('/api/calls', callRouter);
app.use('/api', messageFileRouter);

app.use('/media/avatars', express.static(
    path.resolve(__dirname, '../storage/uploads/avatars'),
    { fallthrough: false, immutable: true, maxAge: '7d', index: false }
));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const isBadJson = error instanceof SyntaxError && error.status === 400 && 'body' in error;
    if (isBadJson) {
        return res.status(400).json({ message: 'JSON request body không hợp lệ' });
    }

    if (error.message === 'Origin not allowed by CORS') {
        return res.status(403).json({ message: 'Origin không được phép truy cập API' });
    }

    if (error.status === 404 && req.path.startsWith('/media/avatars/')) {
        return res.status(404).json({ message: 'Không tìm thấy avatar' });
    }

    console.error('[API ERROR]', {
        method: req.method,
        path: req.path,
        message: error.message
    });
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
});

module.exports = app;