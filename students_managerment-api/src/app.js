const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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

const app = express();
const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
].filter(Boolean));

app.use(express.json());

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Origin not allowed by CORS'));
        },
        credentials: true
    })
);

app.use(cookieParser());

app.get('/', (req, res) => {
    res.json({
        message: 'Student Management API is running'
    });
});

app.use('/api/students', studentRouter);
app.use('/api/classes', classerRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/enrollments', enrollmentRouter);
app.use('/api/semesters', semesterRouter);
app.use('/api/subjects', subjectRouter);
app.use('/api/auth', authRouter);
// api session
app.use('/api/auth/sessions',sessionRouter);
// api chat 
app.use('/api/conversations', conversationRouter);
app.use('/api/messages', messageRouter);

module.exports = app;