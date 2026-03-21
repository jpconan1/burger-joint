export class Clock {
    constructor() {
        this.lastTime = 0;
        this.dt = 0;
        this.elapsed = 0;
        this.lineBoil = false;
        this.lineBoilTimer = 0;
        this.lineBoilInterval = 1000 / 15; // 15fps
    }

    tick(currentTime) {
        if (!this.lastTime) this.lastTime = currentTime;
        this.dt = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.elapsed += this.dt;

        this.lineBoilTimer += (currentTime - (this.lastTime - this.dt * 1000));
        while (this.lineBoilTimer >= this.lineBoilInterval) {
            this.lineBoilTimer -= this.lineBoilInterval;
            this.lineBoil = !this.lineBoil;
        }
    }
}

export const gameClock = new Clock();
