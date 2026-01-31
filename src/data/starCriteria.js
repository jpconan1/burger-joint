export const STAR_CRITERIA = [
    {
        id: 'service_star',
        name: 'Service Star',
        check: (game) => game.currentDayPerfect
    },
    {
        id: 'burger_star',
        name: 'Burger Star',
        check: (game) => {
            const burgerCount = game.menuSystem.menuSlots.slice(0, 4).filter(s => s !== null).length;
            return burgerCount >= 2;
        }
    },
    {
        id: 'addon_star',
        name: 'Add On Star',
        check: (game) => {
            return game.menuSystem.sides.length > 0 || game.menuSystem.drinks.length > 0;
        }
    },
    {
        id: 'complexity_1',
        name: 'Complexity Star I',
        check: (game) => {
            return game.menuSystem.calculateComplexity() >= 15;
        }
    },
    {
        id: 'complexity_2',
        name: 'Complexity Star II',
        check: (game) => {
            return game.menuSystem.calculateComplexity() >= 30;
        }
    }
];
