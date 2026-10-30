const academicService = require('../service/academicService.js');

function parseSemesterId(req, res) {
    const parsed = academicService.parseOptionalSemesterId(req.query.semesterId);
    if (!parsed.valid) {
        res.status(400).json({ message: 'semesterId phải là số nguyên dương' });
        return undefined;
    }
    return parsed.value;
}

exports.getMyProfile = async (req, res, next) => {
    try { return res.json(await academicService.getMyProfile(req.user.id)); }
    catch (error) { return next(error); }
};

exports.getMyGrades = async (req, res, next) => {
    const semesterId = parseSemesterId(req, res);
    if (semesterId === undefined) return;
    try { return res.json(await academicService.getMyGrades(req.user.id, semesterId)); }
    catch (error) { return next(error); }
};

exports.getStudentByCode = async (req, res, next) => {
    const semesterId = parseSemesterId(req, res);
    if (semesterId === undefined) return;
    try {
        const result = await academicService.getStudentByCode(req.params.studentCode, semesterId);
        if (result.status === 'not_found') return res.status(404).json(result);
        return res.json(result);
    } catch (error) {
        if (error.status === 400) return res.status(400).json({ message: error.message });
        return next(error);
    }
};
