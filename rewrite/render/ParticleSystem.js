export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawn(x, y, options = {}) {
        const p = {
            x,
            y,
            vx: options.vx || (Math.random() - 0.5) * 50,
            vy: options.vy || (Math.random() - 0.5) * 50,
            life: options.life || 0.5,
            maxLife: options.life || 0.5,
            size: options.size || 5,
            color: options.color || '#fff',
            alpha: 1,
            // Sprite support
            sprite: options.sprite || null,
            frame: 0,
            totalFrames: options.totalFrames || 1,
            frameRate: options.frameRate || 10,
            scale: options.scale || 1
        };
        this.particles.push(p);
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.alpha = p.life / p.maxLife;
            
            if (p.sprite) {
                // Update animation frame based on life if totalFrames > 1
                const progress = 1 - (p.life / p.maxLife);
                p.frame = Math.floor(progress * p.totalFrames);
                if (p.frame >= p.totalFrames) p.frame = p.totalFrames - 1;
            }

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx, spriteRenderer = null) {
        ctx.save();
        for (const p of this.particles) {
            if (p.sprite && spriteRenderer) {
                spriteRenderer.draw(p.sprite, p.x, p.y, {
                    frameX: p.frame,
                    frameWidth: 64, // Assume 64 for dust
                    frameHeight: 64,
                    alpha: p.alpha,
                    scale: p.scale
                });
            } else {
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

export const particleSystem = new ParticleSystem();
