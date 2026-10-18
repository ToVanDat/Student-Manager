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

const app = express();
app.disable('x-powered-by');

// Baseline security headers for API responses. HSTS is intentionally left to
// the TLS-terminating reverse proxy so local HTTP development keeps working.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
    next();
});

const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
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
app.use('/api/users', userRouter);
app.use('/api/permissions', permissionRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/messages', messageRouter);
app.use('/api/calls', callRouter);
app.use('/api', messageFileRouter);

// Serve only normalized avatar images publicly. Chat attachments stay behind
// their authenticated download endpoint and are not exposed by static hosting.
app.use('/media/avatars', express.static(
    path.resolve(__dirname, '../storage/uploads/avatars'),
    { fallthrough: false, immutable: true, maxAge: '7d', index: false }
));

// Keep API errors JSON-shaped and avoid returning internal stack traces.
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