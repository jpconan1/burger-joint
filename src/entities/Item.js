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

    get category() {
        return this.definition.category;
    }

    _initializeState() {
        const def = this.definition;

        // 1. Load data-driven initial state if available
        if (def.initialState) {
            this.state = { ...def.initialState };
        }

        // 1b. Auto-init cooking state if applicable
        if (def.cooking) {
            if (!this.state.cook_level) this.state.cook_level = 'raw';
            if (this.state.cookingProgress === undefined) this.state.cookingProgress = 0;
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
                    bun: null,
                    patty: null,
                    toppings: [],
                    sauces: [],
                    ...this.state
                };

                // Auto-populate defaults for burgers if empty
                // Exclude burger_old effectively
                if (this.definitionId.includes('burger') && this.definitionId !== 'burger_old') {
                    if (!this.state.bun) this.state.bun = new ItemInstance('plain_bun');
                    if (!this.state.patty) {
                        const p = new ItemInstance('beef_patty');
                        p.state.cook_level = 'cooked';
                        this.state.patty = p;
                    }
                    // Simple heuristic for legacy items
                    if (this.state.toppings.length === 0) {
                        // Check logic: if it has tomato and mayo, which one is bottom?
                        // Assuming standard build: Top Bun <- Mayo <- Tomato <- Patty <- Bottom Bun
                        // So Mayo is last (top).

                        // We push in order: Bottom -> Top

                        if (this.definitionId.includes('tomato')) {
                            this.state.toppings.push(new ItemInstance('tomato_slice'));
                        }

                        if (this.definitionId.includes('mayo')) {
                            this.state.toppings.push('mayo');
                        }
                    }
                }
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
                    // Normalize standard rule to a list of conditions
                    let conditions = rule.conditions || [];

                    // Backward compatibility for simple "stateKey/value" rules
                    if (rule.stateKey) {
                        conditions = [
                            ...conditions,
                            {
                                stateKey: rule.stateKey,
                                value: rule.value,
                                comparator: rule.comparator || 'eq'
                            }
                        ];
                    }

                    // Evaluate all conditions
                    const match = conditions.every(cond => {
                        const currentVal = this.state[cond.stateKey];
                        const targetVal = cond.value;

                        switch (cond.comparator || 'eq') {
                            case 'eq': return currentVal === targetVal;
                            case 'neq': return currentVal !== targetVal;
                            case 'gt': return currentVal > targetVal;
                            case 'gte': return currentVal >= targetVal;
                            case 'lt': return currentVal < targetVal;
                            case 'lte': return currentVal <= targetVal;
                            default: return false;
                        }
                    });

                    if (match) return rule.texture;
                }
            }
            return base;
        }

        // 1.5 Aging Texture Logic
        if (this.definition.aging && this.definition.aging.stages && this.state.age) {
            const stages = this.definition.aging.stages;
            // Find the highest stage <= current age
            let matchedTexture = null;
            let maxStageDay = -1;

            for (const [day, texture] of Object.entries(stages)) {
                const dayNum = parseInt(day);
                if (this.state.age >= dayNum && dayNum > maxStageDay) {
                    maxStageDay = dayNum;
                    matchedTexture = texture;
                }
            }

            if (matchedTexture) return matchedTexture;
        }

        // 2. Legacy/Hardcoded Logic (Preserved for items not yet refactored)
        // Box Logic
        if (this.type === ItemType.Box) {
            if (this.state.count <= 0) return 'empty-box.png';

            if (this.state.isOpen) {
                return `${this.definitionId}-open.png`;
            }

            // Custom Closed Texture Support
            if (this.definition.texture) {
                return this.definition.texture;
            }

            return `${this.definitionId}-closed.png`;
        }

        // Composite / Burger Logic
        if (this.type === ItemType.Composite) {
            if (this.state.isWrapped) return 'burger-wrapped.png';
        }

        if (this.definitionId === 'bag') {
            const contents = this.state.contents || [];
            if (contents.length === 0) return 'bag-empty.png';
            // Per user request: any content = bag-burger.png for now
            return 'bag-burger.png';
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

