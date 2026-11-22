export class AudioSystem {
    constructor(settings) {
        this.settings = settings;
        this.ctx = null;
        this.assetLoader = null;

        // Nodes
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.filterNode = null;

        // State
        this.currentMusicData = null; // { introSource, loopSource, musicId }
        this.audioBufferCache = new Map();
        this.musicRequestId = 0;
        this.isMuffled = false;
        this.initialized = false;
    }

    init(assetLoader) {
        this.assetLoader = assetLoader;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            this.ctx = new AudioContext();

            // Build Graph:
            // Music -> MusicGain -> Filter -> MasterGain -> Dest
            // SFX -> SFXGain -> MasterGain -> Dest

            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.filterNode = this.ctx.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = 22000; // Open (no filtering)

            this.musicGain.connect(this.filterNode);
            this.filterNode.connect(this.masterGain);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);

            this.initialized = true;
            console.log('AudioSystem initialized');

            this.updateVolumesFromSettings();

        } catch (e) {
            console.error("Web Audio API not supported", e);
        }
    }

    async resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
            console.log('AudioContext resumed');
        }
    }

    updateVolumesFromSettings() {
        if (!this.ctx) return;

        const musicOn = this.settings.preferences?.musicEnabled ?? true;
        const sfxOn = this.settings.preferences?.sfxEnabled ?? true;

        const now = this.ctx.currentTime;
        // Smooth transition to avoid pops
        this.musicGain.gain.setTargetAtTime(musicOn ? 0.3 : 0, now, 0.1); // Music lower volume default
        this.sfxGain.gain.setTargetAtTime(sfxOn ? 0.6 : 0, now, 0.1);
    }

    async playMusic(introKey, loopKey) {
        if (!this.ctx) return;

        this.stopMusic();
        const requestId = ++this.musicRequestId;

        let introBuffer = null;
        if (introKey) {
            introBuffer = await this.decode(introKey);
        }
        const loopBuffer = await this.decode(loopKey);

        if (requestId !== this.musicRequestId) return;
        if (!loopBuffer) return; // Must have loop at least

        // Create Sources
        let introSource = null;
        if (introBuffer) {
            introSource = this.ctx.createBufferSource();
            introSource.buffer = introBuffer;
            introSource.connect(this.musicGain);
        }

        const loopSource = this.ctx.createBufferSource();
        loopSource.buffer = loopBuffer;
        loopSource.loop = true;
        loopSource.connect(this.musicGain);

        // Schedule
        const now = this.ctx.currentTime;
        const startTime = now + 0.05;

        if (introSource && introBuffer) {
            introSource.start(startTime);
            loopSource.start(startTime + introBuffer.duration);
        } else {
            loopSource.start(startTime);
        }

        this.currentMusicData = {
            introSource,
            loopSource,
            introKey,
            loopKey,
            introBuffer,
            loopBuffer,
            introStartTime: introSource ? startTime : null,
            loopStartTime: introSource && introBuffer ? startTime + introBuffer.duration : startTime
        };
    }

    async playMusicAfterCurrentLoop(loopKey) {
        if (!this.ctx) return;
        if (this.currentMusicData?.loopKey === loopKey) return;
        if (this.currentMusicData?.pendingLoopKey === loopKey) return;

        const current = this.currentMusicData;
        if (!current?.loopBuffer || current.loopStartTime === undefined) {
            this.playMusic(null, loopKey);
            return;
        }

        const requestId = ++this.musicRequestId;
        current.pendingLoopKey = loopKey;
        const nextBuffer = await this.decode(loopKey);
        if (requestId !== this.musicRequestId || !nextBuffer) return;

        const now = this.ctx.currentTime;
        const loopDuration = current.loopBuffer.duration;
        let startTime;

        if (now < current.loopStartTime) {
            startTime = current.loopStartTime + loopDuration;
        } else {
            const elapsed = now - current.loopStartTime;
            const loopsElapsed = Math.floor(elapsed / loopDuration) + 1;
            startTime = current.loopStartTime + loopsElapsed * loopDuration;
            if (startTime - now < 0.03) startTime += loopDuration;
        }

        const nextSource = this.ctx.createBufferSource();
        nextSource.buffer = nextBuffer;
        nextSource.loop = true;
        nextSource.connect(this.musicGain);
        nextSource.start(startTime);

        if (current.introSource) {
            try {
                current.introSource.stop(startTime);
            } catch (e) {
                // Ignore already-stopped sources.
            }
        }
        if (current.loopSource) {
            try {
                current.loopSource.stop(startTime);
            } catch (e) {
                // Ignore already-stopped sources.
            }
        }

        current.pendingSource = nextSource;
        current.pendingLoopKey = loopKey;
        current.pendingLoopBuffer = nextBuffer;
        current.pendingLoopStartTime = startTime;
        current.pendingTimeout = globalThis.setTimeout(() => {
            if (this.musicRequestId !== requestId || this.currentMusicData !== current || current.pendingSource !== nextSource) {
                return;
            }
            this.currentMusicData = {
                introSource: null,
                loopSource: nextSource,
                introKey: null,
                loopKey,
                introBuffer: null,
                loopBuffer: nextBuffer,
                introStartTime: null,
                loopStartTime: startTime
            };
        }, Math.max(0, (startTime - this.ctx.currentTime) * 1000));
    }

    stopMusic() {
        this.musicRequestId++;
        if (this.currentMusicData) {
            if (this.currentMusicData.pendingTimeout) {
                globalThis.clearTimeout(this.currentMusicData.pendingTimeout);
            }
            if (this.currentMusicData.pendingSource) {
                try {
                    this.currentMusicData.pendingSource.stop();
                } catch (e) {
                    // Ignore errors
                }
            }
            if (this.currentMusicData.introSource) {
                try {
                    this.currentMusicData.introSource.stop();
                } catch (e) {
                    // Ignore errors
                }
            }
            if (this.currentMusicData.loopSource) {
                try {
                    this.currentMusicData.loopSource.stop();
                } catch (e) {
                    // Ignore errors
                }
            }
            this.currentMusicData = null;
        }
    }

    isPlayingMusic(loopKey) {
        return this.currentMusicData?.loopKey === loopKey || this.currentMusicData?.pendingLoopKey === loopKey;
    }

    async playSFX(key) {
        if (!this.ctx) return;
        const buffer = await this.decode(key);
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.sfxGain);
        source.start();
    }

    setMuffled(muffled) {
        if (!this.ctx || !this.filterNode) return;
        if (this.isMuffled === muffled) return;
        this.isMuffled = muffled;

        const now = this.ctx.currentTime;
        const targetFreq = muffled ? 600 : 22000;

        // Cancel scheduled changes to avoid conflict
        this.filterNode.frequency.cancelScheduledValues(now);
        // Anchor at current value to prevent jumping
        this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
        // Ramp
        this.filterNode.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.5);
    }

    async decode(key) {
        if (this.audioBufferCache.has(key)) return this.audioBufferCache.get(key);

        const arrayBuffer = this.assetLoader.get(key);
        if (!arrayBuffer) {
            // Asset might not be loaded yet or failed
            return null;
        }

        // We must clone because decodeAudioData detaches the buffer
        const copiedBuffer = arrayBuffer.slice(0);

        try {
            const audioBuffer = await this.ctx.decodeAudioData(copiedBuffer);
            this.audioBufferCache.set(key, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.error(`Failed to decode audio: ${key}`, e);
            return null;
        }
    }
}
