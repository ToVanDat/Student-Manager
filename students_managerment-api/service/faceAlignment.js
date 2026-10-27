'use strict';

const OUTPUT_SIZE = 112;
const PAD_SIZE = 80;

// Qualcomm's MobileFaceNet application configuration:
// default_square=true, inner_padding_factor=0.25, outer_padding=(0,0).
// Derived from the canonical 96x112 five-point template in align_faces.py.
const REFERENCE_POINTS = Object.freeze([
    [44.19639969, 53.13086701],
    [67.68786621, 53.00093333],
    [56.01679993, 66.49106852],
    [46.36620077, 80.24366760],
    [65.81993357, 80.13606771]
]);

function invalid(message) {
    const error = new Error(message);
    error.code = 'FACE_PREPROCESSING_INVALID';
    return error;
}

function validateFivePoints(points) {
    if (!Array.isArray(points) || points.length !== 5 ||
        points.some(point => !Array.isArray(point) || point.length !== 2 ||
            point.some(value => typeof value !== 'number' || !Number.isFinite(value)))) {
        throw invalid('Face landmarks must contain five finite x/y points');
    }
    return points;
}

function estimateSimilarityTransform(source, destination = REFERENCE_POINTS) {
    validateFivePoints(source);
    validateFivePoints(destination);
    const mean = points => [
        points.reduce((sum, point) => sum + point[0], 0) / points.length,
        points.reduce((sum, point) => sum + point[1], 0) / points.length
    ];
    const sourceMean = mean(source);
    const destinationMean = mean(destination);
    let denominator = 0;
    let real = 0;
    let imaginary = 0;

    for (let i = 0; i < 5; i += 1) {
        const sx = source[i][0] - sourceMean[0];
        const sy = source[i][1] - sourceMean[1];
        const dx = destination[i][0] - destinationMean[0];
        const dy = destination[i][1] - destinationMean[1];
        denominator += sx * sx + sy * sy;
        real += sx * dx + sy * dy;
        imaginary += sx * dy - sy * dx;
    }
    if (!Number.isFinite(denominator) || denominator < 1e-6) {
        throw invalid('Face landmarks are degenerate');
    }

    const a = real / denominator;
    const b = imaginary / denominator;
    const tx = destinationMean[0] - (a * sourceMean[0] - b * sourceMean[1]);
    const ty = destinationMean[1] - (b * sourceMean[0] + a * sourceMean[1]);
    const determinant = a * a + b * b;
    if (!Number.isFinite(determinant) || determinant < 1e-12) {
        throw invalid('Face alignment transform is degenerate');
    }
    return { a, b, tx, ty, determinant };
}

function sampleBilinear(rgb, width, height, x, y, channel) {
    if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return 0;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);
    const dx = x - x0;
    const dy = y - y0;
    const p00 = rgb[(y0 * width + x0) * 3 + channel];
    const p10 = rgb[(y0 * width + x1) * 3 + channel];
    const p01 = rgb[(y1 * width + x0) * 3 + channel];
    const p11 = rgb[(y1 * width + x1) * 3 + channel];
    return (p00 * (1 - dx) + p10 * dx) * (1 - dy) +
        (p01 * (1 - dx) + p11 * dx) * dy;
}

function validateImage(rgb, width, height) {
    if (!Buffer.isBuffer(rgb) || !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 || rgb.length !== width * height * 3) {
        throw invalid('Decoded RGB image buffer does not match its dimensions');
    }
}

function alignRgbFace(rgb, width, height, fivePoints) {
    validateImage(rgb, width, height);
    const transform = estimateSimilarityTransform(fivePoints);
    const { a, b, tx, ty, determinant } = transform;
    const inverseA = a / determinant;
    const inverseB = b / determinant;
    const output = Buffer.alloc(OUTPUT_SIZE * OUTPUT_SIZE * 3);

    for (let y = 0; y < OUTPUT_SIZE; y += 1) {
        for (let x = 0; x < OUTPUT_SIZE; x += 1) {
            const dx = x - tx;
            const dy = y - ty;
            const sourceX = inverseA * dx + inverseB * dy;
            const sourceY = -inverseB * dx + inverseA * dy;
            const offset = (y * OUTPUT_SIZE + x) * 3;
            for (let channel = 0; channel < 3; channel += 1) {
                output[offset + channel] = Math.round(
                    sampleBilinear(rgb, width, height, sourceX, sourceY, channel)
                );
            }
        }
    }
    return output;
}

function cropPadRgb(rgb, width, height, bbox, expansion = 2.7) {
    validateImage(rgb, width, height);
    if (!bbox || !['x', 'y', 'width', 'height'].every(key =>
        Number.isFinite(bbox[key])) || bbox.width <= 0 || bbox.height <= 0 ||
        !Number.isFinite(expansion) || expansion < 1 || expansion > 4) {
        throw invalid('Face bounding box for PAD is invalid');
    }
    const side = Math.max(bbox.width, bbox.height) * expansion;
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const left = centerX - side / 2;
    const top = centerY - side / 2;
    const output = Buffer.alloc(PAD_SIZE * PAD_SIZE * 3);

    for (let y = 0; y < PAD_SIZE; y += 1) {
        for (let x = 0; x < PAD_SIZE; x += 1) {
            const sourceX = left + (x + 0.5) * side / PAD_SIZE - 0.5;
            const sourceY = top + (y + 0.5) * side / PAD_SIZE - 0.5;
            const offset = (y * PAD_SIZE + x) * 3;
            for (let channel = 0; channel < 3; channel += 1) {
                output[offset + channel] = Math.round(
                    sampleBilinear(rgb, width, height, sourceX, sourceY, channel)
                );
            }
        }
    }
    return output;
}

function toNchwFloat(rgb, width, height, channelOrder = [0, 1, 2]) {
    if (!Buffer.isBuffer(rgb) || rgb.length !== width * height * 3 ||
        channelOrder.length !== 3 || channelOrder.some(index => ![0, 1, 2].includes(index))) {
        throw invalid('RGB crop cannot be converted to NCHW');
    }
    const output = new Float32Array(3 * width * height);
    for (let channel = 0; channel < 3; channel += 1) {
        const sourceChannel = channelOrder[channel];
        const channelOffset = channel * width * height;
        for (let pixel = 0; pixel < width * height; pixel += 1) {
            output[channelOffset + pixel] = rgb[pixel * 3 + sourceChannel] / 255;
        }
    }
    return output;
}

function prepareFaceTensors(rgb, width, height, landmarks) {
    if (!landmarks || landmarks.width !== width || landmarks.height !== height) {
        throw invalid('Server landmark dimensions do not match decoded image');
    }
    validateFivePoints(landmarks.five);
    if (landmarks.five.some(([x, y]) => x < 0 || y < 0 || x >= width || y >= height)) {
        throw invalid('Server landmarks fall outside the decoded image');
    }
    const bbox = landmarks.bbox;
    if (!bbox || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bbox[key])) ||
        bbox.x < 0 || bbox.y < 0 || bbox.width < 40 || bbox.height < 40 ||
        bbox.x + bbox.width > width + 1 || bbox.y + bbox.height > height + 1) {
        throw invalid('Server face bounding box is outside the decoded image');
    }
    const aligned = alignRgbFace(rgb, width, height, landmarks.five);
    const padCrop = cropPadRgb(rgb, width, height, landmarks.bbox, 2.7);
    return {
        rgb112: toNchwFloat(aligned, OUTPUT_SIZE, OUTPUT_SIZE),
        bgr80: toNchwFloat(padCrop, PAD_SIZE, PAD_SIZE, [2, 1, 0])
    };
}

module.exports = {
    OUTPUT_SIZE,
    PAD_SIZE,
    REFERENCE_POINTS,
    validateFivePoints,
    estimateSimilarityTransform,
    alignRgbFace,
    cropPadRgb,
    toNchwFloat,
    prepareFaceTensors
};
