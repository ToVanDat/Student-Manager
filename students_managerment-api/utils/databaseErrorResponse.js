const respondWithDatabaseError = (res, error, fallbackMessage) => {
    // Return actionable, non-sensitive errors for common constraint failures.
    // Never expose PostgreSQL messages, SQL fragments, or internal schema details.
    if (error?.code === '23505') {
        return res.status(409).json({
            message: 'Dữ liệu đã tồn tại hoặc bị trùng'
        });
    }

    if (error?.code === '23503') {
        return res.status(409).json({
            message: 'Không thể thực hiện thao tác vì dữ liệu đang được tham chiếu'
        });
    }

    if (error?.code === '23502' || error?.code === '22P02' || error?.code === '22007') {
        return res.status(400).json({
            message: 'Dữ liệu gửi lên không hợp lệ'
        });
    }

    console.error('[DATABASE OPERATION FAILED]', {
        code: error?.code || 'UNKNOWN',
        message: error?.message || 'Unknown database error'
    });

    return res.status(500).json({
        message: fallbackMessage || 'Không thể xử lý yêu cầu'
    });
};

module.exports = { respondWithDatabaseError };
