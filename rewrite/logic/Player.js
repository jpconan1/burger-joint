import { inputManager, ACTIONS } from '../core/InputManager.js';
import { particleSystem } from '../render/ParticleSystem.js';
import { State } from '../core/State.js';



export class Player {
    constructor(x, y, tileSize) {
        this.gridX = x;
        this.gridY = y;
        this.targetX = x * tileSize;
        this.targetY = y * tileSize;
        this.x = x * tileSize;
        this.y = y * tileSize;
        this.tileSize = tileSize;
        this.speed = 10; // Speed of lerp or transition
        this.moveCooldown = 0;
        this.moveInterval = 0.15; // Time between grid moves
        this.isMoving = false;
        
        // Juicy bits
        this.tilt = 0;
        this.walkBob = 0;
        this.rotation = 0; // Rotation for paws
    }

    update(dt) {
        // Linear interpolation towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        
        const moveStep = 600 * dt; // Pixels per second
        
        const spawnDust = (gx, gy) => {
            particleSystem.spawn(gx * this.tileSize, gy * this.tileSize, {
                sprite: 'dust',
                totalFrames: 6,
                scale: 1.0,
                vx: 0,
                vy: 0,
                life: 0.4
            });
        };

        if (Math.abs(dx) > moveStep) {
            this.x += Math.sign(dx) * moveStep;
            this.isMoving = true;
        } else {
            this.x = this.targetX;
        }

        if (Math.abs(dy) > moveStep) {
            this.y += Math.sign(dy) * moveStep;
            this.isMoving = true;
        } else {
            this.y = this.targetY;
        }

        if (this.x === this.targetX && this.y === this.targetY) {
            this.isMoving = false;
        }

        if (this.moveCooldown > 0) {
            this.moveCooldown -= dt;
        }

        if (!this.isMoving && this.moveCooldown <= 0) {
            const move = inputManager.getMovementVector();
            if (move.x !== 0 || move.y !== 0) {
                // Priority to X then Y for 4-way feel
                let nx = this.gridX;
                let ny = this.gridY;
                
                if (move.x !== 0) {
                    nx += move.x;
                } else if (move.y !== 0) {
                    ny += move.y;
                }

                if (State.isWalkable(nx, ny)) {
                    this.rotation = Math.atan2(move.y, move.x) + Math.PI / 2;
                    spawnDust(this.gridX, this.gridY);
                    this.gridX = nx;
                    this.gridY = ny;
                    this.targetX = this.gridX * this.tileSize;
                    this.targetY = this.gridY * this.tileSize;
                    this.moveCooldown = this.moveInterval;
                }
            }
        }

        // Juice: Tilt when moving
        if (this.isMoving) {
            this.tilt = Math.sin(Date.now() / 50) * 0.1;
        } else {
            this.tilt *= 0.8;
        }
    }

    draw(renderer, spriteRenderer) {
        // Draw player base
        renderer.drawEntity('player', this.x, this.y, { tilt: this.tilt });
        
        // Draw paws on top
        if (spriteRenderer) {
            spriteRenderer.draw('paws', this.x, this.y, { 
                rotation: this.rotation,
                scale: 1.0
            });
        }
    }
}
