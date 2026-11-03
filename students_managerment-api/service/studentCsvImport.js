const MAX_IMPORT_ROWS = 500;
const REQUIRED_HEADERS = ['student_code', 'name', 'email', 'class_code'];
const ALLOWED_HEADERS = new Set([
    'student_code',
    'name',
    'email',
    'date_of_birth',
    'gender',
    'class_code',
    'class_name'
]);

const makeCsvError = (message, statusCode = 400, code = 'STUDENT_CSV_INVALID') => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

const parseCsvRecords = (source) => {
    if (typeof source !== 'string' || source.length === 0) {
        throw makeCsvError('Tệp CSV trống.');
    }
    if (source.length > 1024 * 1024) {
        throw makeCsvError('Tệp CSV vượt quá giới hạn 1 MB.', 413, 'STUDENT_CSV_TOO_LARGE');
    }

    const text = source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source;
    const records = [];
    let record = [];
    let field = '';
    let inQuotes = false;
    let quoteClosed = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                    quoteClosed = true;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (quoteClosed) {
            if (char === ',') {
                record.push(field);
                field = '';
                quoteClosed = false;
            } else if (char === '\r' || char === '\n') {
                record.push(field);
                if (record.some(value => value.trim() !== '')) records.push(record);
                record = [];
                field = '';
                quoteClosed = false;
                if (char === '\r' && text[i + 1] === '\n') i += 1;
            } else if (char === ' ' || char === '\t') {
                // Ignore harmless whitespace between a closing quote and delimiter.
            } else {
                throw makeCsvError('CSV có ký tự không hợp lệ sau dấu ngoặc kép.');
            }
            continue;
        }

        if (char === '"') {
            if (field.length !== 0) {
                throw makeCsvError('CSV có dấu ngoặc kép không đúng vị trí.');
            }
            inQuotes = true;
        } else if (char === ',') {
            record.push(field);
            field = '';
        } else if (char === '\r' || char === '\n') {
            record.push(field);
            if (record.some(value => value.trim() !== '')) records.push(record);
            record = [];
            field = '';
            if (char === '\r' && text[i + 1] === '\n') i += 1;
        } else {
            field += char;
        }
    }

    if (inQuotes) throw makeCsvError('CSV có trường chưa đóng dấu ngoặc kép.');
    record.push(field);
    if (record.some(value => value.trim() !== '')) records.push(record);

    return records;
};

const isRealDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
        return false;
    }
    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return date.getTime() <= todayUtc;
};

const validateStudentCsvText = (source) => {
    const records = parseCsvRecords(source);
    if (records.length < 2) throw makeCsvError('CSV phải có hàng tiêu đề và ít nhất một sinh viên.');
    const headers = records[0].map(value => value.trim().toLowerCase());
    if (headers.some(value => !value)) throw makeCsvError('Tên cột CSV không được để trống.');
    if (new Set(headers).size !== headers.length) throw makeCsvError('CSV có tên cột bị trùng.');
    const unknownHeaders = headers.filter(value => !ALLOWED_HEADERS.has(value));
    if (unknownHeaders.length) throw makeCsvError('CSV có cột không hỗ trợ: ' + unknownHeaders.join(', '));
    const missingHeaders = REQUIRED_HEADERS.filter(value => !headers.includes(value));
    if (missingHeaders.length) throw makeCsvError('CSV thiếu cột bắt buộc: ' + missingHeaders.join(', '));

    const dataRecords = records.slice(1);
    if (dataRecords.length > MAX_IMPORT_ROWS) {
        throw makeCsvError('Mỗi lần chỉ được nhập tối đa ' + MAX_IMPORT_ROWS + ' sinh viên.', 413, 'STUDENT_CSV_TOO_MANY_ROWS');
    }

    const seenCodes = new Set();
    const seenEmails = new Set();
    const rows = dataRecords.map((values, index) => {
        const rowNumber = index + 2;
        const errors = [];
        if (values.length !== headers.length) {
            errors.push('Số cột không khớp với hàng tiêu đề.');
        }
        const sourceRow = Object.fromEntries(headers.map((header, columnIndex) => [
            header,
            String(values[columnIndex] ?? '').trim()
        ]));

        const student_code = sourceRow.student_code || '';
        const name = sourceRow.name || '';
        const email = (sourceRow.email || '').toLowerCase();
        const class_code = (sourceRow.class_code || '').toUpperCase();
        const date_of_birth = sourceRow.date_of_birth || null;
        const gender = sourceRow.gender || null;

        if (!student_code) errors.push('Thiếu mã sinh viên.');
        else if (student_code.length > 10) errors.push('Mã sinh viên không được vượt quá 10 ký tự.');
        if (!name) errors.push('Thiếu họ và tên.');
        else if (name.length > 20) errors.push('Họ và tên không được vượt quá 20 ký tự.');
        if (!email) errors.push('Thiếu email.');
        else if (email.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email không hợp lệ (tối đa 50 ký tự).');
        if (!class_code) errors.push('Thiếu mã lớp.');
        if (date_of_birth && !isRealDate(date_of_birth)) errors.push('Ngày sinh phải đúng định dạng YYYY-MM-DD và không ở tương lai.');
        if (gender && !['Nam', 'Nữ'].includes(gender)) errors.push('Giới tính chỉ nhận Nam hoặc Nữ.');

        const normalizedCode = student_code.toLowerCase();
        if (normalizedCode && seenCodes.has(normalizedCode)) errors.push('Mã sinh viên bị trùng trong tệp.');
        if (normalizedCode) seenCodes.add(normalizedCode);
        if (email && seenEmails.has(email)) errors.push('Email bị trùng trong tệp.');
        if (email) seenEmails.add(email);

        return {
            rowNumber,
            student_code,
            name,
            email,
            date_of_birth,
            gender,
            class_code,
            errors
        };
    });

    return { rows, totalRows: rows.length };
};

module.exports = {
    MAX_IMPORT_ROWS,
    parseCsvRecords,
    validateStudentCsvText,
    makeCsvError
};
