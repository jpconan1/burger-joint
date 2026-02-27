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
        dishwasher: 150,

        // Actions
        expansion: 50
    },

    // Game Pacing & Flow
    GAME_PACING: {
        // 3 minutes (180s) from Peak Day to Peak Night implies a 6 minute (360s) full cycle.
        // Or simply: Half Cycle = 180s.
        HALF_CYCLE_DURATION: 120,

        // Ticket Logic
        SLOW_TICKET_INTERVAL: 33,
        FAST_TICKET_INTERVAL: 5,

        // Pacing Curves
        DAY_PEAK_TIME_RATIO: 0.75, // Peak at 75% of the day
        NIGHT_PEAK_TIME_RATIO: 0.85, // Peak at 85% of the night

        DAY_PEAK_INTENSITY: 0.8, // 80% to max speed
        NIGHT_PEAK_INTENSITY: 1.0, // 100% to max speed

        // Width of the bell curve (Standard Deviation in seconds)
        PEAK_WIDTH: 20
    }
};
