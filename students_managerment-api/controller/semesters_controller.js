const semestersService = require('../service/semestersService.js');
const { respondWithDatabaseError } = require('../utils/databaseErrorResponse.js');


// GET tất cả học kỳ
const getSemesters = async (req, res) => {
    try {

        const semesters =
            await semestersService.getAllSemesters();

        res.json(semesters);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
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

        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};


// POST thêm học kỳ
const createSemester = async (req, res) => {
    try {

        const semester =
            await semestersService.createSemester(req.body);

        res.status(201).json(semester);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể thêm học kỳ');
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

        return respondWithDatabaseError(res, error, 'Không thể cập nhật học kỳ');
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

        return respondWithDatabaseError(res, error, 'Không thể xóa học kỳ');
    }
};


module.exports = {
    getSemesters,
    getSemesterById,
    createSemester,
    updateSemester,
    deleteSemester
};