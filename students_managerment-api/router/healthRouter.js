const express = require('express');
const pool = require('../src/config/database');
const { redisClient } = require('../src/config/redis');
const { getReadiness } = require('../service/healthService');

const router = express.Router();

router.get('/live', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.get('/ready', async (req, res) => {
    const readiness = await getReadiness({ pool, redisClient });
    return res.status(readiness.ready ? 200 : 503).json({
        status: readiness.ready ? 'ready' : 'not_ready',
        checks: readiness.checks
    });
});

module.exports = router;
