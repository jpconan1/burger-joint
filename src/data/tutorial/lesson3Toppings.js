import { item, makeTicket, makeTutorialRoom, plateStack, recipeAlert, recipeImage, recipeTile, row, symbol } from './helpers.js';

const recipeRows = [
    row(recipeImage('assets/bacon-raw.png'), symbol('+'), recipeTile('assets/sheets/grill_sheet.png'), symbol('='), recipeImage('assets/bacon-cooked.png')),
    row(recipeImage('assets/tomato.png'), symbol('+'), recipeImage('assets/cutting_boards/board.png'), symbol('='), recipeImage('assets/tomato-slice.png')),
    row(recipeImage('assets/burger.png'), symbol('+'), recipeImage('assets/bacon-cooked.png'), symbol('+'), recipeImage('assets/lettuce-leaf.png'), symbol('+'), recipeImage('assets/tomato-slice.png'))
];

export const LESSON_3_TOPPINGS = {
    id: 'toppings',
    label: 'Lesson 3: Toppings',
    player: { x: 5, y: 2, facing: { x: 0, y: 1 } },
    level: makeTutorialRoom({
        1: item('bacon_box'),
        2: item('lettuce_box'),
        3: item('tomato_box'),
        4: item('board'),
        6: item('patty_box'),
        7: item('bun_box'),
        8: plateStack()
    }, { 5: 'GRILL' }),
    ticket: () => makeTicket(3, 'plate', ['bacon', 'lettuce_leaf', 'tomato_slice']),
    alert: recipeAlert(recipeRows)
};
