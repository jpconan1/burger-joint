export const SCORING_CONFIG = {
    // Time added to the "Par Time" for each component (in seconds)
    PAR_TIMES: {
        burger: 30,
        topping_tomato: 20,
        sauce: 12, // mayo
        fries: 25,
        soda: 15
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
        drink_cup_box: 25,
        syrup_box: 40,
        side_cup_box: 15,

        // Appliances
        counter: 10,
        floor: 5,
        cutting_board: 30,
        dispenser: 75,
        fryer: 200,
        soda_fountain: 300,
        stove: 100,

        // Actions
        expansion: 100
    }
};
