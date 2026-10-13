const SOUND_PATHS = Object.freeze({
    notification: '/sounds/sound_notification.mp3',
    incomingCall: '/sounds/sound_ring.mp3',
    outgoingCall: '/sounds/sound_outgoing.mp3',
    callBusy: '/sounds/call_busy.mp3',
    callEnded: '/sounds/sound_call_ended.mp3',
    callError: '/sounds/sound_call_error.mp3'
});

const audioCache = new Map();

export const playSound = async (name, { volume = 0.65, loop = false } = {}) => {
    const src = SOUND_PATHS[name];
    if (!src || typeof window === 'undefined') return null;
    try {
        let audio = audioCache.get(name);
        if (!audio) {
            audio = new Audio(src);
            audio.preload = 'auto';
            audioCache.set(name, audio);
        }
        audio.pause();
        audio.currentTime = 0;
        audio.volume = Math.min(1, Math.max(0, Number(volume) || 0));
        audio.loop = Boolean(loop);
        await audio.play();
        return audio;
    } catch (error) {
        // Browsers can block autoplay until the user interacts with the page.
        if (error?.name !== 'NotAllowedError') console.warn('[sound] Could not play sound:', name, error?.message);
        return null;
    }
};

export const stopSound = name => {
    const audio = audioCache.get(name);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.loop = false;
};

export const stopAllSounds = () => {
    for (const audio of audioCache.values()) {
        audio.pause();
        audio.currentTime = 0;
        audio.loop = false;
    }
};

export const SOUND_PATHS_EXPORT = SOUND_PATHS;
