const subjectService = require('../service/subjectService.js');

    
const getSubjects = async (req, res) => {
    try {

        const subjects = await subjectService.getAllSubjects();

        res.json(subjects);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
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

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};


const createSubject = async (req, res) => {
    try {

        const subject = await subjectService.createSubject(req.body);

        res.status(201).json(subject);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể thêm môn học',
            error: error.message
        });
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

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể cập nhật môn học',
            error: error.message
        });
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

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể xóa môn học',
            error: error.message
        });
    }
};


module.exports = {
    getSubjects,
    getSubjectById,
    createSubject,
    updateSubject,
    deleteSubject
}; 