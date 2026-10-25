const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHistory, clearHistory, extractSubjectSearchTerm, loadAcademicContext } = require('../service/chatbotService.js');
const pool = require('../src/config/database.js');

test('normalizeHistory keeps only the latest eight valid messages', () => {
    const history = Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        content: `message-${index}`
    }));
    const result = normalizeHistory(history);
    assert.equal(result.length, 8);
    assert.equal(result[0].content, 'message-2');
    assert.equal(result[7].content, 'message-9');
});

test('normalizeHistory strips unsupported roles and bounds message content', () => {
    const result = normalizeHistory([
        { role: 'system', content: 'must not inject system role' },
        { role: 'assistant', content: 'a'.repeat(5000) },
        { role: 'user', content: '  hello  ' },
        null
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].role, 'assistant');
    assert.equal(result[0].content.length, 4000);
    assert.equal(result[1].role, 'user');
    assert.equal(result[1].content, 'hello');
});

test('clearHistory deletes only the authenticated user and session history key', async () => {
    const deletedKeys = [];
    const redis = {
        isReady: true,
        del: async key => { deletedKeys.push(key); return 1; }
    };

    await clearHistory({ userId: '42', sessionId: 'session-abc', redis });
    assert.deepEqual(deletedKeys, ['assistant:history:42:session-abc']);
});

test('clearHistory fails closed when Redis is unavailable', async () => {
    const redis = { isReady: false };
    await assert.rejects(
        clearHistory({ userId: '42', sessionId: 'session-abc', redis }),
        error => error.status === 503
    );
});

test('extractSubjectSearchTerm detects an explicitly named Vietnamese or English subject', () => {
    assert.equal(extractSubjectSearchTerm('Cho tôi biết môn học Toán rời rạc?'), 'Toán rời rạc');
    assert.equal(extractSubjectSearchTerm('Môn: CS101'), 'CS101');
    assert.equal(extractSubjectSearchTerm('Find subject Database Systems'), 'Database Systems');
});

test('extractSubjectSearchTerm ignores unrelated or incomplete questions', () => {
    assert.equal(extractSubjectSearchTerm('Xin chào, tôi cần tư vấn'), null);
    assert.equal(extractSubjectSearchTerm('Môn học nào có nhiều tín chỉ?'), null);
    assert.equal(extractSubjectSearchTerm(null), null);
});

test('loadAcademicContext includes only public class and department catalog fields', async () => {
    const originalQuery = pool.query;
    const calls = [];
    pool.query = async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('FROM subjects')) return { rows: [{ subject_code: 'CS101', subject_name: 'Intro', credits: 3 }] };
        if (sql.includes('FROM semesters')) return { rows: [{ semester_name: 'Fall', academic_year: '2026' }] };
        if (sql.includes('FROM departments')) return { rows: [{ department_code: 'IT', department_name: 'Information Technology' }] };
        if (sql.includes('FROM classes')) return { rows: [{ class_code: 'IT01', class_name: 'IT Class', department_code: 'IT', department_name: 'Information Technology' }] };
        throw new Error('Unexpected chatbot context query');
    };

    try {
        const context = await loadAcademicContext('student', 'show me class information');
        assert.equal(context.departments[0].department_code, 'IT');
        assert.equal(context.classes[0].class_code, 'IT01');
        assert.equal(context.catalog[0].subject_code, 'CS101');
        assert.equal(context.semesters[0].semester_name, 'Fall');
        assert.equal(calls.length, 4);
        assert.ok(calls.every(call => call.sql.includes('LIMIT $1') ? call.params?.[0] === 80 : true));
        assert.ok(calls.every(call => !/SELECT\s+\*/i.test(call.sql)));
    } finally {
        pool.query = originalQuery;
    }
});
