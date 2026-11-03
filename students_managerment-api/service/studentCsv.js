const CSV_COLUMNS = [
    'student_code',
    'name',
    'email',
    'date_of_birth',
    'gender',
    'class_code',
    'class_name'
];

const toCsvCell = (value) => {
    let text = value === null || value === undefined
        ? ''
        : value instanceof Date
            ? value.toISOString().slice(0, 10)
            : String(value);

    // Prevent spreadsheet applications from evaluating user-controlled cells as formulas.
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) {
        text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
};

const buildStudentsCsv = (rows = []) => {
    const records = [
        CSV_COLUMNS,
        ...rows.map(student => CSV_COLUMNS.map(column => student?.[column]))
    ];
    return '\uFEFF' + records.map(record => record.map(toCsvCell).join(',')).join('\r\n') + '\r\n';
};

module.exports = { buildStudentsCsv, toCsvCell };
