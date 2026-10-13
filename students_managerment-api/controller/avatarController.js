const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const pool = require('../src/config/database');

const AVATAR_DIR = path.resolve(__dirname, '../storage/uploads/avatars');
const PUBLIC_PREFIX = '/media/avatars/';

const uploadAvatar = async (req, res, next) => {
    let savedPath = null;
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ message: 'Hãy chọn một ảnh avatar' });
        }

        // Decode the file rather than trusting the browser-supplied MIME type.
        const metadata = await sharp(req.file.buffer, { failOn: 'error' }).metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format) ||
            !metadata.width || !metadata.height ||
            metadata.width > 8000 || metadata.height > 8000 ||
            metadata.width * metadata.height > 25_000_000) {
            return res.status(415).json({ message: 'Ảnh avatar không hợp lệ hoặc có kích thước quá lớn' });
        }

        await fs.mkdir(AVATAR_DIR, { recursive: true });
        const filename = `${crypto.randomUUID()}.webp`;
        savedPath = path.join(AVATAR_DIR, filename);
        await sharp(req.file.buffer)
            .rotate()
            .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
            .webp({ quality: 84 })
            .toFile(savedPath);

        const avatarUrl = `${PUBLIC_PREFIX}${filename}`;
        const previousResult = await pool.query(
            'SELECT avatar_url FROM users WHERE id = $1 AND is_active = TRUE',
            [Number(req.user.id)]
        );
        if (!previousResult.rows[0]) {
            await fs.unlink(savedPath).catch(() => {});
            return res.status(404).json({ message: 'Không tìm thấy tài khoản đang hoạt động' });
        }
        const previousAvatarUrl = previousResult.rows[0].avatar_url;
        const { rows } = await pool.query(
            `UPDATE users SET avatar_url = $1, updated_at = NOW()
             WHERE id = $2 AND is_active = TRUE
             RETURNING id, username, email, role, avatar_url, updated_at`,
            [avatarUrl, Number(req.user.id)]
        );

        if (!rows[0]) {
            await fs.unlink(savedPath).catch(() => {});
            return res.status(404).json({ message: 'Không tìm thấy tài khoản đang hoạt động' });
        }

        // Remove only previous files owned by this avatar endpoint.
        const previous = previousAvatarUrl;
        if (typeof previous === 'string' && previous.startsWith(PUBLIC_PREFIX)) {
            const oldName = path.basename(previous);
            if (/^[a-f0-9-]{36}\.webp$/i.test(oldName) && oldName !== filename) {
                await fs.unlink(path.join(AVATAR_DIR, oldName)).catch(() => {});
            }
        }

        return res.status(200).json({
            message: 'Cập nhật avatar thành công',
            user: rows[0]
        });
    } catch (error) {
        if (savedPath) await fs.unlink(savedPath).catch(() => {});
        if (error?.name === 'Error' && /unsupported image format|Input buffer contains unsupported image format/i.test(error.message)) {
            return res.status(415).json({ message: 'Nội dung file không phải ảnh hợp lệ' });
        }
        return next(error);
    }
};

module.exports = { uploadAvatar };
