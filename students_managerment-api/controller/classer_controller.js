const classerService = require('../service/classerService.js');
const { respondWithDatabaseError } = require('../utils/databaseErrorResponse.js');

const getClasses = async (req, res) => {
    try {

        const classes = await classerService.getAllClasses();

        res.json(classes);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};


const getClassById = async (req, res) => {
    try {

        const { id } = req.params;

        const classer = await classerService.getClassById(id);

        if (!classer) {
            return res.status(404).json({
                message: 'Không tìm thấy lớp'
            });
        }

        res.json(classer);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};

const createClass = async (req, res) => {
    try {

        const classer = await classerService.createClass(req.body);

        res.status(201).json(classer);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể thêm lớp');
    }
};

const updateClass = async (req, res) => {
    try {

        const { id } = req.params;

        const classer = await classerService.updateClass(
            id,
            req.body
        );

        if (!classer) {
            return res.status(404).json({
                message: 'Không tìm thấy lớp'
            });
        }

        res.json(classer);

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể cập nhật lớp');
    }
};

const deleteClass = async (req, res) => {
    try {

        const { id } = req.params;

        const classer = await classerService.deleteClass(id);

        if (!classer) {
            return res.status(404).json({
                message: 'Không tìm thấy lớp'
            });
        }

        res.json({
            message: 'Xóa lớp thành công',
            classer: classer
        });

    } catch (error) {

        return respondWithDatabaseError(res, error, 'Không thể xóa lớp');
    }
};


module.exports = {
    getClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};