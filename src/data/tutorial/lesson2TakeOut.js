import { item, makeTicket, makeTutorialRoom, recipeAlert, recipeImage, row, symbol } from './helpers.js';

const recipeRows = [
    row(recipeImage('assets/burger.png'), symbol('+'), recipeImage('assets/wrapper.png'), symbol('='), recipeImage('assets/burger-wrapped.png')),
    row(recipeImage('assets/fry_bag.png'), symbol('+'), recipeImage('assets/fryer.png'), symbol('='), recipeImage('assets/fries-done.png')),
    row(recipeImage('assets/burger-wrapped.png'), symbol('+'), recipeImage('assets/fries-done.png'), symbol('+'), recipeImage('assets/bag-empty.png'), symbol('='), recipeImage('assets/bag-burger.png'))
];

export const LESSON_2_TAKE_OUT = {
    id: 'take_out',
    label: 'Lesson 2: Take-Out',
    player: { x: 5, y: 2, facing: { x: 0, y: 1 } },
    level: makeTutorialRoom({
        1: item('bag_box'),
        2: item('wrapper_box'),
        3: item('patty_box'),
        4: item('bun_box'),
        7: item('fry_box'),
        8: item('side_cup_box')
    }, { 5: 'GRILL', 6: 'FRYER' }),
    ticket: () => makeTicket(2, 'bag', [], ['fries']),
    alert: recipeAlert(recipeRows)
};
