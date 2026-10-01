const semestersService = require('../service/semestersService.js');


// GET tất cả học kỳ
const getSemesters = async (req, res) => {
    try {

        const semesters =
            await semestersService.getAllSemesters();

        res.json(semesters);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};


// GET học kỳ theo ID
const getSemesterById = async (req, res) => {
    try {

        const { id } = req.params;

        const semester =
            await semestersService.getSemesterById(id);

        if (!semester) {
            return res.status(404).json({
                message: 'Không tìm thấy học kỳ'
            });
        }

        res.json(semester);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};


// POST thêm học kỳ
const createSemester = async (req, res) => {
    try {

        const semester =
            await semestersService.createSemester(req.body);

        res.status(201).json(semester);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể thêm học kỳ',
            error: error.message
        });
    }
};


// PATCH cập nhật học kỳ
const updateSemester = async (req, res) => {
    try {

        const { id } = req.params;

        const semester =
            await semestersService.updateSemester(
                id,
                req.body
            );

        if (!semester) {
            return res.status(404).json({
                message: 'Không tìm thấy học kỳ'
            });
        }

        res.json(semester);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể cập nhật học kỳ',
            error: error.message
        });
    }
};


// DELETE xóa học kỳ
const deleteSemester = async (req, res) => {
    try {

        const { id } = req.params;

        const semester =
            await semestersService.deleteSemester(id);

        if (!semester) {
            return res.status(404).json({
                message: 'Không tìm thấy học kỳ'
            });
        }

        res.json({
            message: 'Xóa học kỳ thành công',
            semester: semester
        });

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể xóa học kỳ',
            error: error.message
        });
    }
};


module.exports = {
    getSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    deleteSemester
};