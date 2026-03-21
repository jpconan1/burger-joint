import { gameClock } from './core/Clock.js';
import { Stage } from './render/Stage.js';
import { TileRenderer } from './render/TileRenderer.js';
import { Player } from './logic/Player.js';
import { particleSystem } from './render/ParticleSystem.js';
import { State } from './core/State.js';
import { SpriteRenderer } from './render/SpriteRenderer.js';




class Game {
    constructor() {
        this.stage = new Stage('game-canvas');
        this.renderer = new TileRenderer(this.stage);
        this.spriteRenderer = new SpriteRenderer(this.stage);
        this.player = null;
        this.init();
    }

    async init() {
        State.initGrid();
        
        await this.renderer.loadAssets();
        await this.spriteRenderer.loadAssets({
            'paws': '/assets/paws.png',
            'dust': '/assets/sheets/dust_sheet.png'
        });
        
        this.player = new Player(2, 3, this.stage.tileSize);
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(currentTime) {
        gameClock.tick(currentTime);
        this.update(gameClock.dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.player) {
            this.player.update(dt);
        }
        particleSystem.update(dt);
    }

    draw() {
        this.stage.clear();
        this.renderer.drawFloor();
        this.renderer.drawGrid();
        
        particleSystem.draw(this.stage.ctx, this.spriteRenderer);

        if (this.player) {
            this.player.draw(this.renderer, this.spriteRenderer);
        }
    }
}

new Game();
