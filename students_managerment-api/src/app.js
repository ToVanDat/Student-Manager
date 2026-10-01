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

const app = express();

app.use(express.json());

app.use(
    cors({
        origin: 'http://localhost:5173',
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
app.use('/api/auth/sessions',sessionRouter);
module.exports = app;