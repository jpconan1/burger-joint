export class Stage {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = 1280;
        this.height = 720;
        this.tileSize = 64;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // High fidelity but maintaining aspect ratio
        const container = document.getElementById('game-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const scale = Math.min(containerWidth / this.width, containerHeight / this.height);
        
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.width = `${this.width * scale}px`;
        this.canvas.style.height = `${this.height * scale}px`;
        
        // Disable smoothing for pixel art
        this.ctx.imageSmoothingEnabled = false;
    }

    clear() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }
}
