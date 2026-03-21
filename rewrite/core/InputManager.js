export const ACTIONS = {
    MOVE_UP: 'MOVE_UP',
    MOVE_DOWN: 'MOVE_DOWN',
    MOVE_LEFT: 'MOVE_LEFT',
    MOVE_RIGHT: 'MOVE_RIGHT',
    INTERACT: 'INTERACT',
    PICK_UP: 'PICK_UP',
    RESTART: 'RESTART',
    SETTINGS: 'SETTINGS',
    ESC: 'ESC'
};

const DEFAULT_MAP = {
    'ArrowUp': ACTIONS.MOVE_UP,
    'KeyW': ACTIONS.MOVE_UP,
    'ArrowDown': ACTIONS.MOVE_DOWN,
    'KeyS': ACTIONS.MOVE_DOWN,
    'ArrowLeft': ACTIONS.MOVE_LEFT,
    'KeyA': ACTIONS.MOVE_LEFT,
    'ArrowRight': ACTIONS.MOVE_RIGHT,
    'KeyD': ACTIONS.MOVE_RIGHT,
    'KeyE': ACTIONS.INTERACT,
    'Space': ACTIONS.PICK_UP,
    'KeyR': ACTIONS.RESTART,
    'Comma': ACTIONS.SETTINGS,
    'Escape': ACTIONS.ESC
};

class InputManager {
    constructor() {
        this.keys = {};
        this.map = { ...DEFAULT_MAP };
        
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));
    }

    handleKey(e, isDown) {
        this.keys[e.code] = isDown;
    }

    isPressed(action) {
        return Object.entries(this.map).some(([code, mappedAction]) => {
            return mappedAction === action && this.keys[code];
        });
    }

    // For single-press actions
    consume(action) {
        const entry = Object.entries(this.map).find(([code, mappedAction]) => {
            return mappedAction === action && this.keys[code];
        });
        if (entry) {
            this.keys[entry[0]] = false;
            return true;
        }
        return false;
    }

    getMovementVector() {
        let x = 0;
        let y = 0;
        if (this.isPressed(ACTIONS.MOVE_LEFT)) x -= 1;
        if (this.isPressed(ACTIONS.MOVE_RIGHT)) x += 1;
        if (this.isPressed(ACTIONS.MOVE_UP)) y -= 1;
        if (this.isPressed(ACTIONS.MOVE_DOWN)) y += 1;
        return { x, y };
    }
}

export const inputManager = new InputManager();
