
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

export class Settings {
    constructor() {
        this.bindings = { ...DEFAULT_BINDINGS };
        this.preferences = {
            musicEnabled: true,
            sfxEnabled: true,
        };
        this.load();
    }

    load() {
        const stored = localStorage.getItem('burger_joint_settings');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.bindings) this.bindings = { ...this.bindings, ...parsed.bindings };
                // Backwards compatibility for old format (which was just bindings)
                else if (parsed.MOVE_UP) this.bindings = { ...this.bindings, ...parsed }; // It looked like definitions were at root level? No, stored was just bindings object.

                // Oops, the previous save method was: localStorage.setItem('burger_joint_settings', JSON.stringify(this.bindings));
                // So parsing it creates an object that IS the bindings.
                // We need to detect if it's the new format { bindings: {}, preferences: {} } or old format { key: val }

                if (parsed.bindings || parsed.preferences) {
                    // New format
                    if (parsed.bindings) this.bindings = { ...this.bindings, ...parsed.bindings };
                    if (parsed.preferences) this.preferences = { ...this.preferences, ...parsed.preferences };
                } else {
                    // Old format (just bindings)
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
        // Optional: Check for conflicts?
        // For now, allow duplicates or just overwrite.
        // It is better to clear other actions using this code if we want to avoid conflicts.
        // However, a simple overwrite is safer for MVP.
        this.bindings[action] = code;
        this.save();
    }

    getActionForCode(code) {
        // Reverse lookup, useful for UI display or checking what key does
        return Object.keys(this.bindings).find(key => this.bindings[key] === code);
    }
}
