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
    SERVE_DRINKS: 'SERVE_DRINKS',
    SERVE_FRIES: 'SERVE_FRIES'
};

export const DEFINITIONS = {
    // --- BOXES ---
    // 'patty box', amount: 12, legal tools: tongs, produces: 'raw patty'
    'patty_box': {
        type: ItemType.Box,
        maxCount: 12,
        legalTool: 'HANDS',
        produces: 'beef_patty',
        toolRequirement: 'HANDS' // To pick up the box itself
    },
    'bun_box': {
        type: ItemType.Box,
        maxCount: 32,
        legalTool: 'HANDS',
        produces: 'plain_bun',
        toolRequirement: 'HANDS'
    },
    'wrapper_box': {
        type: ItemType.Box,
        maxCount: 100,
        legalTool: 'HANDS',
        produces: 'wrapper',
        toolRequirement: 'HANDS'
    },

    'fry_box': {
        type: ItemType.Box,
        maxCount: 3,
        legalTool: 'HANDS',
        produces: 'fry_bag',
        toolRequirement: 'HANDS'
    },
    'side_cup_box': {
        type: ItemType.Box,
        maxCount: 25,
        legalTool: 'HANDS',
        produces: 'side_cup',
        toolRequirement: 'HANDS'
    },

    'syrup_box': {
        type: ItemType.Box,
        maxCount: 1,
        legalTool: 'HANDS',
        produces: 'soda_syrup',
        toolRequirement: 'HANDS'
    },
    'drink_cup_box': {
        type: ItemType.Box,
        maxCount: 15,
        legalTool: 'HANDS',
        produces: 'drink_cup',
        toolRequirement: 'HANDS'
    },
    'mayo_box': {
        type: ItemType.Box,
        maxCount: 3,
        legalTool: 'HANDS',
        produces: 'mayo_bag',
        toolRequirement: 'HANDS'
    },
    'tomato_box': {
        type: ItemType.Box,
        maxCount: 25, // Variable 20-25, fixed for now
        legalTool: 'HANDS',
        produces: 'tomato',
        toolRequirement: 'HANDS'
    },
    'bag_box': {
        type: ItemType.Box,
        maxCount: 20,
        legalTool: 'HANDS',
        produces: 'bag',
        toolRequirement: 'HANDS'
    },

    // --- INGREDIENTS ---
    'plain_bun': {
        type: ItemType.Ingredient,
        texture: 'bun.png',
        toolRequirement: 'HANDS'
    },
    'beef_patty': {
        type: ItemType.Ingredient,
        toolRequirement: 'HANDS',
        initialState: {
            cook_level: 'raw',
            cookingProgress: 0
        },
        cooking: {
            stages: {
                'raw': { next: 'cooked', duration: 2000 }

            }
        },
        textures: {
            base: 'patty-raw.png',
            rules: [
                { stateKey: 'cook_level', value: 'cooked', texture: 'patty-cooked.png' }
            ]
        }
    },
    'tomato': {
        type: ItemType.Ingredient,
        texture: 'tomato.png',
        toolRequirement: 'HANDS'
    },
    'tomato_slice': {
        type: ItemType.Ingredient,
        texture: 'tomato-slice.png',
        toolRequirement: 'HANDS'
    },

    'fries': {
        type: ItemType.Ingredient,
        texture: 'fries.png', // raw/cooked handle in state
        toolRequirement: 'HANDS'
    },

    'plain_burger': {
        type: ItemType.Composite,
        texture: 'burger.png',
        toolRequirement: 'HANDS'
    },
    'burger_tomato': {
        type: ItemType.Composite, // Behaves like a burger
        texture: 'burger-tomato.png',
        toolRequirement: 'HANDS'
    },
    'burger_mayo': {
        type: ItemType.Composite,
        texture: 'burger-mayo.png',
        toolRequirement: 'HANDS'
    },
    'burger_tomato_mayo': {
        type: ItemType.Composite,
        texture: 'burger-tomato-mayo.png',
        toolRequirement: 'HANDS'
    },
    // --- CONTAINERS ---
    'wrapper': {
        type: ItemType.Container,
        texture: 'wrapper.png',
        toolRequirement: 'HANDS'
    },

    'fry_bag': {
        type: ItemType.Ingredient,
        texture: 'fry_bag.png',
        toolRequirement: 'HANDS'
    },
    'fry_bag_open': {
        type: ItemType.Ingredient,
        toolRequirement: 'HANDS',
        initialState: {
            charges: 3
        },
        textures: {
            base: 'fry_bag-open-full.png',
            rules: [
                { stateKey: 'charges', value: 3, texture: 'fry_bag-open-full.png' },
                { stateKey: 'charges', value: 2, texture: 'fry_bag-open-partial1.png' },
                { stateKey: 'charges', value: 1, texture: 'fry_bag-open-partial2.png' }
            ]
        }
    },
    'side_cup': {
        type: ItemType.Container, // Holds sauce?
        texture: 'side_cup.png',
        toolRequirement: 'HANDS'
    },
    'drink_cup': {
        type: ItemType.Container,
        texture: 'drink_cup.png',
        toolRequirement: 'HANDS'
    },

    // --- SAUCES / LIQUIDS ---

    'soda_syrup': {
        type: ItemType.Ingredient,
        texture: 'soda_syrup.png',
        toolRequirement: 'HANDS'
    },
    'soda': {
        type: ItemType.Container,
        texture: 'soda.png',
        toolRequirement: 'HANDS'
    },
    'mayo_bag': {
        type: ItemType.SauceContainer, // Special type?
        texture: 'mayo-bag.png',
        toolRequirement: 'HANDS'
    },
    'bag': {
        type: ItemType.Container,
        texture: 'bag-empty.png', // Default
        toolRequirement: 'HANDS'
    }
};
