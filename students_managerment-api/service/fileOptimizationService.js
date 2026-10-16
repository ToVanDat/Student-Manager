const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm']);
const MAX_IMAGE_PIXELS = 40_000_000;
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const FFMPEG_TIMEOUT_MS = Math.max(1_000, Number.parseInt(process.env.FFMPEG_TIMEOUT_MS || '120000', 10) || 120000);

const runFfmpeg = (args) => new Promise((resolve, reject) => {
    const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        reject(new Error('FFmpeg timed out after ' + FFMPEG_TIMEOUT_MS + 'ms'));
    }, FFMPEG_TIMEOUT_MS);
    child.stderr.on('data', chunk => { if (stderr.length < 8000) stderr += chunk.toString(); });
    child.once('error', error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
    });
    child.once('close', code => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        code === 0 ? resolve() : reject(new Error('FFmpeg exited with code ' + code + ': ' + stderr));
    });
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

async function optimizeImage(file, quality = 'standard') {
    if (quality === 'original') return { optimized: false, reason: 'original-requested' };
    if (!sharp || !IMAGE_MIMES.has(file.mimetype)) return { optimized: false, reason: 'sharp-unavailable-or-unsupported' };
    const temp = path.join(path.dirname(file.path), '.' + crypto.randomUUID() + '.optimized');
    try {
        const metadata = await sharp(file.path, { limitInputPixels: MAX_IMAGE_PIXELS, animated: false }).metadata();
        if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
            return { optimized: false, reason: 'image-dimensions-out-of-policy' };
        }
        let pipeline = sharp(file.path, { limitInputPixels: MAX_IMAGE_PIXELS });
        const maxDimension = quality === 'hd' ? 3840 : 2560;
        if (metadata.width > maxDimension || metadata.height > maxDimension) {
            pipeline = pipeline.resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true });
        }
        const compressionQuality = quality === 'hd' ? 92 : 82;
        if (file.mimetype === 'image/jpeg') pipeline = pipeline.jpeg({ quality: compressionQuality, mozjpeg: true });
        else if (file.mimetype === 'image/png') pipeline = pipeline.png({ compressionLevel: 9, palette: true });
        else pipeline = pipeline.webp({ quality: compressionQuality });
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

async function optimizeVideo(file, quality = 'standard') {
    if (quality === 'original') return { optimized: false, reason: 'original-requested' };
    if (!VIDEO_MIMES.has(file.mimetype)) return { optimized: false, reason: 'unsupported-video' };
    const temp = path.join(path.dirname(file.path), '.' + crypto.randomUUID() + (file.mimetype === 'video/webm' ? '.webm' : '.mp4'));
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', file.path, '-map', '0:v:0?', '-map', '0:a:0?'];
    const videoHeight = ({ '480p': 480, standard: 720, '720p': 720, '1080p': 1080 })[quality] || 720;
    const crf = ({ '480p': 30, standard: 27, '720p': 27, '1080p': 23 })[quality] || 27;
    const maxWidth = Math.round(videoHeight * 16 / 9);
    args.push('-vf', `scale=w='trunc(min(iw\\,${maxWidth})/2)*2':h='trunc(min(ih\\,${videoHeight})/2)*2':force_original_aspect_ratio=decrease`);
    if (file.mimetype === 'video/webm') {
        args.push('-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '4', '-crf', String(crf + 7), '-b:v', '0', '-c:a', 'libopus', '-b:a', '96k', '-f', 'webm');
    } else {
        args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart');
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

async function optimizeUploadedFile(file, quality = 'standard') {
    if (!file?.path || !file.mimetype) return { optimized: false, reason: 'invalid-input' };
    if (IMAGE_MIMES.has(file.mimetype)) return optimizeImage(file, quality);
    if (VIDEO_MIMES.has(file.mimetype)) return optimizeVideo(file, quality);
    // GIF animation, audio, PDF/Office documents, and text are preserved byte-for-byte.
    return { optimized: false, reason: 'preserved-original' };
}

module.exports = { optimizeUploadedFile };
