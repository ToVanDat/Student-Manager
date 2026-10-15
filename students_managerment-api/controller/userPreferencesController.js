const repository = require('../repository/userPreferencesRepository.js');

const getPreferences = async (req, res) => {
    try {
        const preferences = await repository.getByUserId(req.user.sub);
        return res.status(200).json({
            preferences: {
                preferredLanguage: preferences.preferred_language,
                theme: preferences.theme,
                updatedAt: preferences.updated_at
            }
        });
    } catch (error) {
        console.error('[USER PREFERENCES][GET]', error);
        return res.status(500).json({ message: 'Không thể tải cài đặt tài khoản' });
    }
};

const updatePreferences = async (req, res) => {
    const { preferredLanguage, theme } = req.body || {};
    if (preferredLanguage === undefined && theme === undefined) {
        return res.status(400).json({ message: 'Cần cung cấp ít nhất một cài đặt cần cập nhật' });
    }
    if (preferredLanguage !== undefined && !['vi', 'en'].includes(preferredLanguage)) {
        return res.status(400).json({ message: 'Ngôn ngữ chỉ hỗ trợ vi hoặc en' });
    }
    if (theme !== undefined && !['light', 'dark', 'system'].includes(theme)) {
        return res.status(400).json({ message: 'Giao diện chỉ hỗ trợ light, dark hoặc system' });
    }

    try {
        const preferences = await repository.updateByUserId(req.user.sub, { preferredLanguage, theme });
        return res.status(200).json({
            message: 'Đã lưu cài đặt tài khoản',
            preferences: {
                preferredLanguage: preferences.preferred_language,
                theme: preferences.theme,
                updatedAt: preferences.updated_at
            }
        });
    } catch (error) {
        console.error('[USER PREFERENCES][PATCH]', error);
        return res.status(500).json({ message: 'Không thể lưu cài đặt tài khoản' });
    }
};

module.exports = { getPreferences, updatePreferences };
