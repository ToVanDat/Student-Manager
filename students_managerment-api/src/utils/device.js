const UAParser = require('ua-parser-js');

const getDeviceInfo = (userAgent) => {
    if (!userAgent) {
        return {
            deviceName: 'Unknown Device',
            browser: 'Unknown Browser',
            os: 'Unknown OS'
        };
    }

    const parser = new UAParser(userAgent);

    const result = parser.getResult();

    const browserName =
        result.browser.name || 'Unknown Browser';

    const browserVersion =
        result.browser.version || '';

    const osName =
        result.os.name || 'Unknown OS';

    const osVersion =
        result.os.version || '';

    let deviceName = 'Unknown Device';

    if (result.device.type === 'mobile') {
        deviceName = 'Mobile';
    } else if (result.device.type === 'tablet') {
        deviceName = 'Tablet';
    } else if (osName === 'Windows') {
        deviceName = 'Windows PC';
    } else if (osName === 'Mac OS') {
        deviceName = 'Mac';
    } else if (osName === 'Android') {
        deviceName = 'Android Device';
    } else if (osName === 'iOS') {
        deviceName = 'iPhone/iPad';
    } else if (osName === 'Linux') {
        deviceName = 'Linux PC';
    }

    return {
        deviceName: `${browserName} trên ${deviceName}`,
        browser: browserVersion
            ? `${browserName} ${browserVersion}`
            : browserName,
        os: osVersion
            ? `${osName} ${osVersion}`
            : osName
    };
};

module.exports = {
    getDeviceInfo
};