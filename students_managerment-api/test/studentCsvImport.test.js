const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseCsvRecords,
    validateStudentCsvText
} = require('../service/studentCsvImport.js');

const header = 'student_code,name,email,date_of_birth,gender,class_code,class_name';

test('CSV parser supports BOM, quoted commas, escaped quotes and multiline cells', () => {
    const parsed = parseCsvRecords('\uFEFFcode,name\r\n001,"An, ""A""\nB"\r\n');
    assert.deepEqual(parsed, [['code', 'name'], ['001', 'An, "A"\nB']]);
});

test('CSV import requires the supported identity and class headers', () => {
    assert.throws(
        () => validateStudentCsvText('student_code,name,email\n001,An,an@example.test'),
        /thiếu cột bắt buộc/i
    );
});

test('CSV import validates required values, lengths, dates and gender', () => {
    const result = validateStudentCsvText(
        header + '\n001,"Nguyễn An",an@example.test,2004-02-30,Khác,CTK44,'
    );
    assert.equal(result.totalRows, 1);
    assert.equal(result.rows[0].errors.length, 2);
    assert.match(result.rows[0].errors.join(' '), /Ngày sinh/);
    assert.match(result.rows[0].errors.join(' '), /Giới tính/);
});

test('CSV import flags duplicate student codes and emails within the file', () => {
    const result = validateStudentCsvText(
        header + '\n001,An,an@example.test,,Nam,CTK44,\n001,Binh,an@example.test,,Nam,CTK44,'
    );
    assert.ok(result.rows[1].errors.some(error => error.toLowerCase().includes('mã sinh viên bị trùng')));
    assert.ok(result.rows[1].errors.some(error => error.toLowerCase().includes('email bị trùng')));
});

test('CSV import rejects malformed quotes and inconsistent column counts', () => {
    assert.throws(() => parseCsvRecords('a,b\n"broken,b'), /chưa đóng/i);
    const result = validateStudentCsvText(header + '\n001,An,an@example.test,,Nam');
    assert.ok(result.rows[0].errors.some(error => error.includes('Số cột')));
});
