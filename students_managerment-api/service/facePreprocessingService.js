'use strict';

const { decodeFaceImage } = require('./faceImageDecoder.js');
const { detectFaceLandmarks } = require('./faceLandmarkClient.js');
const { prepareFaceTensors } = require('./faceAlignment.js');

async function prepareFaceInferenceTensors(imageBuffer) {
    const decoded = await decodeFaceImage(imageBuffer);
    const landmarks = await detectFaceLandmarks(imageBuffer);
    return {
        ...prepareFaceTensors(decoded.data, decoded.width, decoded.height, landmarks),
        liveness: landmarks.liveness
    };
}

module.exports = { prepareFaceInferenceTensors };
