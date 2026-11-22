import { insertStack, item, makeTicket, makeTutorialRoom, plateStack, recipeAlert, recipeImage, recipeTile, row, symbol } from './helpers.js';

const recipeRows = [
    row(recipeImage('assets/mushroom.png'), symbol('+'), recipeImage('assets/cutting_boards/board.png'), symbol('='), recipeImage('assets/mushroom_slice.png')),
    row(recipeImage('assets/mushroom_slice.png'), symbol('+'), recipeImage('assets/insert.png'), symbol('+'), recipeTile('assets/sheets/grill_sheet.png'), symbol('='), recipeImage('assets/grilled_mushroom.png')),
    row(recipeImage('assets/grilled_mushroom.png'), symbol('+'), recipeImage('assets/burger.png'), symbol('='), recipeImage('assets/burger.png'))
];

export const LESSON_4_INSERTS = {
    id: 'inserts',
    label: 'Lesson 4: Inserts',
    requiresInsert: true,
    player: { x: 5, y: 2, facing: { x: 0, y: 1 } },
    level: makeTutorialRoom({
        1: item('mushroom_box'),
        2: item('board'),
        3: insertStack(),
        4: item('patty_box'),
        6: item('bun_box'),
        8: plateStack()
    }, { 5: 'GRILL' }),
    ticket: () => makeTicket(4, 'plate', ['mushroom_slice']),
    alert: recipeAlert(recipeRows)
};
