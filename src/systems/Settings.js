
export const ACTIONS = {
    MOVE_UP: 'MOVE_UP',
    MOVE_DOWN: 'MOVE_DOWN',
    MOVE_LEFT: 'MOVE_LEFT',
    MOVE_RIGHT: 'MOVE_RIGHT',
    INTERACT: 'INTERACT',
    PICK_UP: 'PICK_UP',
    VIEW_ORDERS: 'VIEW_ORDERS',
};

export const DEFAULT_BINDINGS = {
    [ACTIONS.MOVE_UP]: 'KeyW',
    [ACTIONS.MOVE_DOWN]: 'KeyS',
    [ACTIONS.MOVE_LEFT]: 'KeyA',
    [ACTIONS.MOVE_RIGHT]: 'KeyD',
    [ACTIONS.INTERACT]: 'Enter',
    [ACTIONS.PICK_UP]: 'Space',
    [ACTIONS.VIEW_ORDERS]: 'ShiftLeft',

};

export const ALT_BINDINGS = {
    [ACTIONS.MOVE_UP]: 'ArrowUp',
    [ACTIONS.MOVE_DOWN]: 'ArrowDown',
    [ACTIONS.MOVE_LEFT]: 'ArrowLeft',
    [ACTIONS.MOVE_RIGHT]: 'ArrowRight',
    [ACTIONS.INTERACT]: 'KeyX',
    [ACTIONS.PICK_UP]: 'KeyZ',
};

export class Settings {
    constructor() {
        this.bindings = { ...DEFAULT_BINDINGS };
        this.preferences = {
            musicEnabled: true,
            sfxEnabled: true,
            controlScheme: 'primary'
        };
        this.load();
    }

    load() {
        const stored = localStorage.getItem('burger_joint_settings');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.bindings || parsed.preferences) {
                    if (parsed.bindings) this.bindings = { ...this.bindings, ...parsed.bindings };
                    if (parsed.preferences) this.preferences = { ...this.preferences, ...parsed.preferences };
                } else if (parsed.MOVE_UP) {
                    // Old format
                    this.bindings = { ...this.bindings, ...parsed };
                }
            } catch (e) {
                console.error('Failed to load settings', e);
            }
        }
    }

    save() {
        const data = {
            bindings: this.bindings,
            preferences: this.preferences
        };
        localStorage.setItem('burger_joint_settings', JSON.stringify(data));
    }

    getBinding(action) {
        return this.bindings[action];
    }

    setBinding(action, code) {
        this.bindings[action] = code;
        this.save();
    }

    getActionForCode(code) {
        return Object.keys(this.bindings).find(key => this.bindings[key] === code);
    }

    // --- Alt Controls Logic ---

    getAction(code) {
        // 1. Check Primary
        const primary = this.getActionForCode(code);
        if (primary) return primary;

        // 2. Check Alt
        return Object.keys(ALT_BINDINGS).find(key => ALT_BINDINGS[key] === code);
    }

    updateControlScheme(code) {
        const isPrimary = Object.values(this.bindings).includes(code);
        const isAlt = Object.values(ALT_BINDINGS).includes(code);

        // Preference Switching
        if (isAlt && !isPrimary) {
            if (this.preferences.controlScheme !== 'alternative') {
                console.log("Switching to Alternative Controls (Silent)");
                this.preferences.controlScheme = 'alternative';
                // Don't save to disk automatically unless desired? 
                // "silently change the flag... messages should display the alt controls"
                // Probably fine to keep in memory or save on specific actions.
                // Let's save it so it persists if they reload.
                this.save();
            }
        } else if (isPrimary && !isAlt) {
            if (this.preferences.controlScheme !== 'primary') {
                console.log("Switching to Primary Controls (Silent)");
                this.preferences.controlScheme = 'primary';
                this.save();
            }
        }
    }

    getDisplayKey(action) {
        if (this.preferences.controlScheme === 'alternative') {
            const alt = ALT_BINDINGS[action];
            if (alt) return this.formatKeyName(alt);
        }
        const prim = this.bindings[action];
        return prim ? this.formatKeyName(prim) : '???';
    }

    formatKeyName(code) {
        return code.replace('Key', '').replace('Digit', '').replace('Arrow', '');
    }
}
