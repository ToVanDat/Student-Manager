const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const MAX_IMAGE_PIXELS = 40_000_000;
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const runFfmpeg = (args) => new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => { if (stderr.length < 8000) stderr += chunk.toString(); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error('FFmpeg exited with code ' + code + ': ' + stderr)));
});

async function replaceIfSmaller(source, candidate) {
    const [original, optimized] = await Promise.all([fs.stat(source), fs.stat(candidate)]);
    if (!optimized.size || optimized.size >= original.size) {
        await fs.unlink(candidate).catch(() => {});
        return false;
    }
    // Candidate is created in the same directory so rename is atomic on the same filesystem.
    await fs.rename(candidate, source);
    return true;
}

async function optimizeImage(file) {
    if (!sharp || !IMAGE_MIMES.has(file.mimetype)) return { optimized: false, reason: 'sharp-unavailable-or-unsupported' };
    const temp = path.join(path.dirname(file.path), '.' + crypto.randomUUID() + '.optimized');
    try {
        const metadata = await sharp(file.path, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false }).metadata();
        if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
            return { optimized: false, reason: 'image-dimensions-out-of-policy' };
        }
        let pipeline = sharp(file.path, { limitInputPixels: MAX_IMAGE_PIXELS });
        if (metadata.width > 2560 || metadata.height > 2560) {
            pipeline = pipeline.resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
        }
        if (file.mimetype === 'image/jpeg') pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
        else if (file.mimetype === 'image/png') pipeline = pipeline.png({ compressionLevel: 9, palette: true });
        else pipeline = pipeline.webp({ quality: 82 });
        await pipeline.toFile(temp);
        const changed = await replaceIfSmaller(file.path, temp);
        if (changed) file.size = (await fs.stat(file.path)).size;
        return { optimized: changed, reason: changed ? 'compressed' : 'original-smaller' };
    } catch (error) {
        await fs.unlink(temp).catch(() => {});
        // Optimization is best-effort: never reject a valid upload only because
        // the optional optimizer failed. Signature validation still runs afterward.
        return { optimized: false, reason: 'optimizer-failed', error: error.message };
    }
}

async function optimizeVideo(file) {
    if (!VIDEO_MIMES.has(file.mimetype)) return { optimized: false, reason: 'unsupported-video' };
    const temp = path.join(path.dirname(file.path), '.' + crypto.randomUUID() + (file.mimetype === 'video/webm' ? '.webm' : '.mp4'));
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', file.path, '-map', '0:v:0?', '-map', '0:a:0?'];
    if (file.mimetype === 'video/webm') {
        args.push('-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '4', '-crf', '34', '-b:v', '0', '-c:a', 'libopus', '-b:a', '96k', '-f', 'webm');
    } else {
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart');
    }
    args.push(temp);
    try {
        await runFfmpeg(args);
        const changed = await replaceIfSmaller(file.path, temp);
        if (changed) file.size = (await fs.stat(file.path)).size;
        return { optimized: changed, reason: changed ? 'compressed' : 'original-smaller' };
    } catch (error) {
        await fs.unlink(temp).catch(() => {});
        // FFmpeg is optional in local development; retain the verified original.
        return { optimized: false, reason: 'ffmpeg-unavailable-or-failed', error: error.message };
    }
}

async function optimizeUploadedFile(file) {
    if (!file?.path || !file.mimetype) return { optimized: false, reason: 'invalid-input' };
    if (IMAGE_MIMES.has(file.mimetype)) return optimizeImage(file);
    if (VIDEO_MIMES.has(file.mimetype)) return optimizeVideo(file);
    // GIF animation, audio, PDF/Office documents, and text are preserved byte-for-byte.
    return { optimized: false, reason: 'preserved-original' };
}

module.exports = { optimizeUploadedFile };
