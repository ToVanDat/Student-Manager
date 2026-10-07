const classerService = require('../service/classerService.js');

const getClasses = async (req, res) => {
    try {

        const classes = await classerService.getAllClasses();

        res.json(classes);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
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

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Database error',
            error: error.message
        });
    }
};

const createClass = async (req, res) => {
    try {

        const classer = await classerService.createClass(req.body);

        res.status(201).json(classer);

    } catch (error) {

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể thêm lớp',
            error: error.message
        });
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

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể cập nhật lớp',
            error: error.message
        });
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

        console.error('LỖI DATABASE:', error);

        res.status(500).json({
            message: 'Không thể xóa lớp',
            error: error.message
        });
    }
};


module.exports = {
    getClasses,
    getClassById,
    createClass,
    updateClass,
    deleteClass
};