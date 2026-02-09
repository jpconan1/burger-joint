export const SCORING_CONFIG = {
    // Time added to the "Par Time" for each component (in seconds)
    DAILY_RENT: 100,
    PAR_TIMES: {
        burger: 40,
        sliced_topping: 7,
        sauce: 6,
        side: 15,
        drink: 7
    },

    // Thresholds (Seconds faster than Par)
    THRESHOLDS: {
        BONUS: 20 // Beat par by 20s or more
    },

    // Financial Consequence
    REWARDS: {
        BONUS: 20,       // Bonus Payout
        PAR: 5,          // Thin Margin
        SLOW: 0         // Loss
    },

    // Shop Prices
    PRICES: {
        // Supplies
        patty_box: 50,
        bun_box: 30,
        wrapper_box: 10,
        bag_box: 15,
        tomato_box: 30,
        mayo_box: 20,
        fry_box: 20,
        drink_cup_box: 15,
        cola_box: 40,
        side_cup_box: 15,

        // Appliances
        counter: 10,
        floor: 5,
        cutting_board: 30,
        dispenser: 125,
        fryer: 100,
        soda_fountain: 200,
        grill: 100,

        // Actions
        expansion: 50
    }
};
