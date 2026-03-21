export class Random {
    constructor(seed) {
        this.seed = seed;
    }

    // Mulberry32 RNG
    next() {
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    float(min, max) {
        return min + this.next() * (max - min);
    }

    int(min, max) {
        return Math.floor(this.float(min, max + 1));
    }

    pick(array) {
        if (!array || array.length === 0) return null;
        return array[this.int(0, array.length - 1)];
    }

    chance(probability) {
        return this.next() < probability;
    }
}
