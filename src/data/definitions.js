import itemsData from './items.json' with { type: 'json' };

export const ItemType = {
    Box: 'Box',
    Ingredient: 'Ingredient',
    Composite: 'Composite',
    Container: 'Container',
    SauceContainer: 'SauceContainer'
};

export const CAPABILITY = {
    BASIC_BURGER: 'BASIC_BURGER',
    CUT_TOPPINGS: 'CUT_TOPPINGS',
    ADD_COLD_SAUCE: 'ADD_COLD_SAUCE',
    ADD_LETTUCE: 'ADD_LETTUCE',
    SERVE_DRINKS: 'SERVE_DRINKS',
    SERVE_FRIES: 'SERVE_FRIES'
};

const hydrateDefinition = (def) => {
    const newDef = { ...def };

    // Hydrate Type
    if (typeof newDef.type === 'string') {
        if (ItemType[newDef.type]) {
            newDef.type = ItemType[newDef.type];
        } else if (newDef.type === 'Composite') {
            newDef.type = ItemType.Composite;
        }
    }

    // Hydrate Capability in orderConfig
    if (newDef.orderConfig && newDef.orderConfig.capability) {
        const capKey = newDef.orderConfig.capability;
        if (CAPABILITY[capKey]) {
            newDef.orderConfig.capability = CAPABILITY[capKey];
        }
    }

    return newDef;
};

const generateDefinitions = () => {
    const defs = {};

    if (!itemsData || !itemsData.groups) {
        console.error("Failed to load items.json definitions!");
        return defs;
    }

    itemsData.groups.forEach(group => {
        if (group.type === 'supply_chain') {
            // Box
            if (group.box) {
                const boxId = group.box.id || group.id + '_box';
                const producesId = group.box.produces || (group.item ? group.item.id : null);

                defs[boxId] = hydrateDefinition({
                    type: 'Box',
                    produces: producesId,
                    toolRequirement: 'HANDS',
                    ...group.box
                });
            }
            // Item
            if (group.item) {
                const itemId = group.item.id;
                defs[itemId] = hydrateDefinition({
                    type: 'Ingredient', // Default
                    toolRequirement: 'HANDS',
                    ...group.item
                });
            }
            // Spoilage
            if (group.spoilage) {
                const spoilId = group.spoilage.id;
                if (spoilId) {
                    defs[spoilId] = hydrateDefinition({
                        type: group.spoilage.type || 'Ingredient',
                        trashOnly: true,
                        toolRequirement: 'HANDS',
                        ...group.spoilage
                    });
                }
            }

        } else if (group.type === 'produce') {
            // Box
            if (group.box) {
                const boxId = group.box.id;
                const producesId = group.box.produces || (group.item ? group.item.id : null);
                defs[boxId] = hydrateDefinition({
                    type: 'Box',
                    produces: producesId,
                    toolRequirement: 'HANDS',
                    ...group.box
                });
            }
            // Item (Head/Raw)
            if (group.item) {
                defs[group.item.id] = hydrateDefinition({
                    type: 'Ingredient',
                    toolRequirement: 'HANDS',
                    ...group.item
                });
            }
            // Slice
            if (group.slice) {
                defs[group.slice.id] = hydrateDefinition({
                    type: 'Ingredient',
                    toolRequirement: 'HANDS',
                    ...group.slice
                });
            }
            // Spoilage
            if (group.spoilage) {
                defs[group.spoilage.id] = hydrateDefinition({
                    type: 'Ingredient',
                    trashOnly: true,
                    toolRequirement: 'HANDS',
                    ...group.spoilage
                });
            }

        } else if (group.type === 'tool_supply') {
            // Simple Item Supply (No layout box, manually shop added)
            if (group.item) {
                defs[group.item.id] = hydrateDefinition({
                    type: 'Ingredient', // Default
                    toolRequirement: 'HANDS',
                    ...group.item
                });
            }

        } else if (group.items) { // complex_group or variant_complex
            // Complex group: just iterate items
            group.items.forEach(item => {
                const extraProps = {};

                // Auto-link Sauce Bags
                if ((item.type === 'SauceContainer' || item.category === 'sauce_refill') && !item.sauceId) {
                    // 1. Try matching Item ID to Group ID (Convention: group 'mayo' has item 'mayo')
                    const sauceCandidate = group.items.find(i => i.id === group.id);
                    if (sauceCandidate) {
                        extraProps.sauceId = sauceCandidate.id;
                    } else {
                        // 2. Fallback: Find first 'topping' ingredient that isn't this bag
                        const topping = group.items.find(i => (i.category === 'topping' || i.category === 'sauce') && i.id !== item.id);
                        if (topping) {
                            extraProps.sauceId = topping.id;
                        }
                    }
                }

                defs[item.id] = hydrateDefinition({
                    toolRequirement: 'HANDS', // Default
                    ...item,
                    ...extraProps
                });
            });
        }
    });

    return defs;
};

export const DEFINITIONS = generateDefinitions();
