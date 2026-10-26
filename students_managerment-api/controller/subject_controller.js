const subjectService = require('../service/subjectService.js');
const { respondWithDatabaseError } = require('../utils/databaseErrorResponse.js');

    
const getSubjects = async (req, res) => {
    try {

        const subjects = await subjectService.getAllSubjects();

        res.json(subjects);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};

const getSubjectById = async (req, res) => {
    try {

        const { id } = req.params;

        const subject = await subjectService.getSubjectById(id);

        if (!subject) {
            return res.status(404).json({
                message: 'Không tìm thấy môn học'
            });
        }

        res.json(subject);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};


const createSubject = async (req, res) => {
    try {

        const subject = await subjectService.createSubject(req.body);

        res.status(201).json(subject);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể thêm môn học');
    }
};

const updateSubject = async (req, res) => {
    try {

        const { id } = req.params;

        const subject = await subjectService.updateSubject(
            id,
            req.body
        );

        if (!subject) {
            return res.status(404).json({
                message: 'Không tìm thấy môn học'
            });
        }

        res.json(subject);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể cập nhật môn học');
    }
};

const deleteSubject = async (req, res) => {
    try {

        const { id } = req.params;

        const subject = await subjectService.deleteSubject(id);

        if (!subject) {
            return res.status(404).json({
                message: 'Không tìm thấy môn học'
            });
        }

        res.json({
            message: 'Xóa môn học thành công',
            subject: subject
        });

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể xóa môn học');
    }
};


module.exports = {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
}; 