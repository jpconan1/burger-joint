export class GameClock {
    constructor({ tickMs = 1000 / 60, maxFrameMs = 250 } = {}) {
        this.tickMs = tickMs;
        this.maxFrameMs = maxFrameMs;
        this.reset();
    }

    reset() {
        this.realFrameTimeMs = 0;
        this.simTimeMs = 0;
        this.tickCount = 0;
        this.accumulatorMs = 0;
        this.lastFrameTimestamp = null;
    }

    beginFrame(frameTimestamp) {
        this.realFrameTimeMs = frameTimestamp;

        if (this.lastFrameTimestamp === null) {
            this.lastFrameTimestamp = frameTimestamp;
            return 0;
        }

        const rawDeltaMs = frameTimestamp - this.lastFrameTimestamp;
        this.lastFrameTimestamp = frameTimestamp;
        const clampedDeltaMs = Math.max(0, Math.min(rawDeltaMs, this.maxFrameMs));
        this.accumulatorMs += clampedDeltaMs;
        return clampedDeltaMs;
    }

    consumeTicks() {
        let tickTotal = 0;
        while (this.accumulatorMs >= this.tickMs) {
            this.accumulatorMs -= this.tickMs;
            this.simTimeMs += this.tickMs;
            this.tickCount += 1;
            tickTotal += 1;
        }
        return tickTotal;
    }
}
