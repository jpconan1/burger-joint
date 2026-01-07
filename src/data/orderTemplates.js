import { CAPABILITY } from './definitions.js';

export const ORDER_TEMPLATES = [
    {
        id: 'plain_burger',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER],
        components: [{ type: 'burger', mods: [] }],
        difficulty: 1,
        payout: 50
    },
    {
        id: 'burger_fries',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.SERVE_FRIES],
        components: [{ type: 'burger', mods: [] }, { type: 'fries' }],
        difficulty: 2,
        payout: 70
    },
    {
        id: 'burger_soda',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.SERVE_DRINKS],
        components: [{ type: 'burger', mods: [] }, { type: 'soda' }],
        difficulty: 2,
        payout: 60
    },
    {
        id: 'full_meal',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.SERVE_FRIES, CAPABILITY.SERVE_DRINKS],
        components: [{ type: 'burger', mods: [] }, { type: 'fries' }, { type: 'soda' }],
        difficulty: 3,
        payout: 100
    },
    {
        id: 'burger_tomato',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.CUT_TOPPINGS],
        components: [{ type: 'burger', mods: ['tomato'] }],
        difficulty: 2,
        payout: 60
    },
    {
        id: 'burger_mayo',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.ADD_COLD_SAUCE],
        components: [{ type: 'burger', mods: ['mayo'] }],
        difficulty: 2,
        payout: 60
    },
    {
        id: 'deluxe_burger',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.CUT_TOPPINGS, CAPABILITY.ADD_COLD_SAUCE],
        components: [{ type: 'burger', mods: ['tomato', 'mayo'] }],
        difficulty: 3,
        payout: 80
    },
    {
        id: 'deluxe_meal',
        requiresCapabilities: [CAPABILITY.BASIC_BURGER, CAPABILITY.CUT_TOPPINGS, CAPABILITY.ADD_COLD_SAUCE, CAPABILITY.SERVE_FRIES, CAPABILITY.SERVE_DRINKS],
        components: [{ type: 'burger', mods: ['tomato', 'mayo'] }, { type: 'fries' }, { type: 'soda' }],
        difficulty: 5,
        payout: 150
    },
    // Fries only
    {
        id: 'just_fries',
        requiresCapabilities: [CAPABILITY.SERVE_FRIES],
        components: [{ type: 'fries' }],
        difficulty: 1,
        payout: 20
    },
    // Soda only
    {
        id: 'just_soda',
        requiresCapabilities: [CAPABILITY.SERVE_DRINKS],
        components: [{ type: 'soda' }],
        difficulty: 1,
        payout: 20
    }
];
