const validateResourceId = (req, res, next) => {
    const { id } = req.params;
    if (!/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
        return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    return next();
};

const validateObjectBody = ({ partial = false } = {}) => (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ message: 'Dữ liệu gửi lên phải là một đối tượng JSON' });
    }
    if (partial && Object.keys(body).length === 0) {
        return res.status(400).json({ message: 'Cần cung cấp ít nhất một trường cần cập nhật' });
    }
    return next();
};

module.exports = { validateResourceId, validateObjectBody };
