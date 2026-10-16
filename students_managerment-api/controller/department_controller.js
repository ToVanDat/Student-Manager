const departmentService = require('../service/departmentService.js');
const { respondWithDatabaseError } = require('../utils/databaseErrorResponse.js');

// GET tất cả khoa
const getAllDepartments = async (req, res) => {
    try {
        const departments = await departmentService.getAllDepartments();

        res.json(departments);

    } catch (error) {
        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};


// GET khoa theo ID
const getDepartmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const department = await departmentService.getDepartmentById(id);

        if (!department) {
            return res.status(404).json({
                message: 'Không tìm thấy khoa'
            });
        }

        res.json(department);

    } catch (error) {
        return respondWithDatabaseError(res, error, 'Không thể tải dữ liệu');
    }
};


// POST thêm khoa
const createDepartment = async (req, res) => {
    try {
        const department = await departmentService.createDepartment(req.body);

        res.status(201).json(department);

    } catch (error) {
        return respondWithDatabaseError(res, error, 'Không thể thêm khoa');
    }
};


// PATCH cập nhật khoa
const updateDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        const department = await departmentService.updateDepartment(
            id,
            req.body
        );

        if (!department) {
            return res.status(404).json({
                message: 'Không tìm thấy khoa'
            });
        }

        res.json(department);

    } catch (error) {
        return respondWithDatabaseError(res, error, 'Không thể cập nhật khoa');
    }
};


// DELETE xóa khoa
const deleteDepartment = async (req, res) => {
    try {
        const { id } = req.params;

        const department = await departmentService.deleteDepartment(id);

        if (!department) {
            return res.status(404).json({
                message: 'Không tìm thấy khoa'
            });
        }

        res.json({
            message: 'Xóa khoa thành công',
            department: department
        });

    } catch (error) {
        return respondWithDatabaseError(res, error, 'Không thể xóa khoa');
    }
};


module.exports = {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};