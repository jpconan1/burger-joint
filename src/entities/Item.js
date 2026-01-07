import { DEFINITIONS, ItemType } from '../data/definitions.js';

export class ItemInstance {
    constructor(definitionId) {
        if (!DEFINITIONS[definitionId]) {
            console.error(`Missing definition for ID: ${definitionId}`);
            // Fallback to avoid crash, but this is bad
            this.definitionId = 'plain_bun';
        } else {
            this.definitionId = definitionId;
        }

        this.state = {};
        this._initializeState();
    }

    get definition() {
        return DEFINITIONS[this.definitionId];
    }

    get type() {
        return this.definition.type;
    }

    _initializeState() {
        const def = this.definition;

        // 1. Load data-driven initial state if available
        if (def.initialState) {
            this.state = { ...def.initialState };
        }

        // 2. Apply type-specific default logic (legacy/fallback)
        switch (def.type) {
            case ItemType.Box:
                this.state = {
                    ...this.state,
                    isOpen: false,
                    count: def.maxCount || 1
                };
                break;

            case ItemType.Composite:
                this.state = {
                    ...this.state,
                    bun: null,
                    patty: null,
                    toppings: [],
                    sauces: []
                };
                break;

            case ItemType.Container:
                // Only init contents if not already present
                if (!this.state.contents) {
                    this.state.contents = [];
                }
                break;
        }
    }

    get texture() {
        return this.getTexture();
    }

    getTexture() {
        // 1. Check for data-driven texture rules
        if (this.definition.textures) {
            const rules = this.definition.textures.rules;
            const base = this.definition.textures.base;

            if (rules) {
                for (const rule of rules) {
                    if (this.state[rule.stateKey] === rule.value) {
                        return rule.texture;
                    }
                }
            }
            return base;
        }

        // 2. Legacy/Hardcoded Logic (Preserved for items not yet refactored)
        // Box Logic
        if (this.type === ItemType.Box) {
            if (this.state.count <= 0) return 'empty-box.png';
            return this.state.isOpen ? `${this.definitionId}-open.png` : `${this.definitionId}-closed.png`;
        }

        // Composite / Burger Logic
        if (this.type === ItemType.Composite) {
            if (this.state.isWrapped) return 'burger-wrapped.png';
        }

        if (this.definitionId === 'bag') {
            const contents = this.state.contents || [];
            if (contents.length === 0) return 'bag-empty.png';

            // Map contents to tags
            const tags = contents.map(item => {
                if (item.type === ItemType.Composite || item.definitionId.includes('burger')) return 'burger';
                if (item.definitionId === 'fries') return 'fries';
                if (item.definitionId === 'soda') return 'soda';
                return '';
            }).filter(t => t);

            // Unique tags
            const uniqueTags = [...new Set(tags)];

            // Sort Order: Burger, Soda, Fries
            const weight = { 'burger': 1, 'soda': 2, 'fries': 3 };
            uniqueTags.sort((a, b) => (weight[a] || 99) - (weight[b] || 99));

            return `bag-${uniqueTags.join('-')}.png`;
        }

        if (this.definition.texture) {
            return this.definition.texture;
        }

        return 'missing.png';
    }

    // Serialization
    serialize() {
        return {
            definitionId: this.definitionId,
            state: this.state
        };
    }

    static deserialize(data) {
        const item = new ItemInstance(data.definitionId);

        // Helper to recursively restore nested items
        const restore = (val) => {
            if (!val || typeof val !== 'object') return val;

            if (Array.isArray(val)) {
                return val.map(restore);
            }

            // Detect ItemInstance structure
            if (val.definitionId && val.state) {
                return ItemInstance.deserialize(val);
            }

            // Regular object
            const newObj = {};
            for (const key in val) {
                newObj[key] = restore(val[key]);
            }
            return newObj;
        };

        item.state = restore(data.state || {});
        return item;
    }
}

