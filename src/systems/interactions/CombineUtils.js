import { ItemInstance } from '../../entities/Item.js';
import { ItemType, DEFINITIONS } from '../../data/definitions.js';

export const _addIngredientToBurger = (burgerItem, feedItem) => {
    if (!burgerItem.state.toppings) burgerItem.state.toppings = [];
    const alreadyHas = burgerItem.state.toppings.some(t => t.definitionId === feedItem.definitionId);
    if (alreadyHas) return false;
    burgerItem.state.toppings.push(feedItem);
    return true;
};

export const _isStackableContainer = (item) => {
    return item && item.definition && item.definition.useStackRender;
};

/**
 * @param {Object} target - The source cell object or box
 * @param {boolean} createInstance - If true, returns a full ItemInstance. If false, returns a lightweight mock for validation.
 */
export const _getPossibleDispensedItem = (target, createInstance = false) => {
    if (!target) return null;
    if (target instanceof ItemInstance || target.type === undefined) return target;
    if (target.type === ItemType.Box && target.state.count > 0) {
        const prodId = target.definition.produces;
        if (prodId) {
            if (createInstance) return new ItemInstance(prodId);
            return {
                definitionId: prodId,
                state: {},
                definition: DEFINITIONS[prodId] || {}
            };
        }
    }
    return null;
};

export const _canContainerHoldItem = (container, target) => {
    if (!container || !target) return false;
    const containerId = container.definitionId;
    const targetDef = target.definition || DEFINITIONS[target.definitionId] || {};
    const targetState = target.state || {};

    if (containerId === 'dirty_plate') return false;

    if (containerId === 'plate') {
        const isUnwrappedBurger = (targetDef.category === 'burger' || target.definitionId.includes('burger')) && !targetState.isWrapped;
        const isCookedSide = (targetDef.category === 'side' || (targetDef.category === 'side_prep' && targetState.cook_level === 'cooked'));

        if (isUnwrappedBurger || isCookedSide) {
            const contents = container.state.contents || [];
            const hasBurger = contents.some(c => (c.definition.category === 'burger' || c.definitionId.includes('burger')));
            const hasSide = contents.some(c => c.definition.category === 'side' || c.definition.category === 'side_prep');

            if (isUnwrappedBurger && !hasBurger) return true;
            if (isCookedSide && !hasSide) return true;
        }
        return false;
    }

    const isCookedBacon = target.definitionId === 'bacon' && targetState.cook_level === 'cooked';
    const isSide = targetDef.category === 'side' || targetDef.category === 'side_prep';
    if (targetDef.isSlice || targetDef.category === 'topping' || targetDef.category === 'patty' || isCookedBacon || isSide) {
        const contents = container.state.contents || [];
        if (contents.length >= 50) return false;
        if (contents.length > 0 && contents[0].definitionId !== target.definitionId) return false;
        return true;
    }

    return false;
};

export const _canContainerDispenseTo = (container, held) => {
    if (!container || !held) return false;
    if (['plate', 'dirty_plate'].includes(container.definitionId)) return false;

    const isBurger = held.category === 'burger' || held.definitionId.includes('burger');
    const isBun = held.category === 'bun';
    if (isBurger || isBun) return true;

    if (_isStackableContainer(held) && held.definitionId !== 'dirty_plate') {
        const contents = container.state.contents || [];
        if (contents.length > 0) {
            return _canContainerHoldItem(held, contents[0]);
        }
    }

    if (held.definitionId === 'side_cup') {
        const contents = container.state.contents || [];
        if (contents.length > 0) {
            const first = contents[0];
            return first.state?.cook_level === 'cooked' && first.definition.result;
        }
    }
    return false;
};

export const _applyIngredientToHeld = (held, ingredient) => {
    if (!held || !ingredient) return held;

    const combined = _tryCombine(held, ingredient);
    if (combined) return combined;

    const isBun = held.category === 'bun';
    let targetBurger = held;

    if (isBun) {
        targetBurger = new ItemInstance('plain_burger');
        targetBurger.state.bun = held;
        targetBurger.state.toppings = [];
    } else {
        targetBurger = held.clone();
    }

    _addIngredientToBurger(targetBurger, ingredient);
    return targetBurger;
};

export const _tryCombine = (held, target) => {
    const isBurger = (i) => i.category === 'burger';
    const isWrapper = (i) => i.definitionId === 'wrapper';

    // 1. Wrapping
    if (isBurger(held) && isWrapper(target)) {
        held.state.isWrapped = true;
        return held;
    }
    if (isWrapper(held) && isBurger(target)) {
        target.state.isWrapped = true;
        return target;
    }

    // 2. Burger Assembly
    const isBun = (i) => i.category === 'bun';
    const isCookedPatty = (i) => i.category === 'patty' && i.state.cook_level === 'cooked';
    const isTopping = (i) => {
        if (i.category === 'topping' || i.category === 'sauce') return true;
        if (i.definition && i.definition.isTopping) {
            if (i.definition.cooking) return i.state.cook_level === 'cooked';
            return true;
        }
        return false;
    };

    let burgerBase = null, itemToAdd = null, bunBase = null;

    if (isBurger(held) && (isTopping(target) || isCookedPatty(target))) {
        burgerBase = held; itemToAdd = target;
    } else if ((isTopping(held) || isCookedPatty(held)) && isBurger(target)) {
        itemToAdd = held; burgerBase = target;
    }

    if (burgerBase && itemToAdd) {
        const newBurger = burgerBase.clone();
        _addIngredientToBurger(newBurger, itemToAdd);
        return newBurger;
    }

    if (isBun(held) && (isCookedPatty(target) || isTopping(target))) {
        bunBase = held; itemToAdd = target;
    } else if ((isCookedPatty(held) || isTopping(held)) && isBun(target)) {
        bunBase = target; itemToAdd = held;
    }

    if (bunBase && itemToAdd) {
        const burger = new ItemInstance('plain_burger');
        burger.state.bun = bunBase;
        burger.state.toppings = [];
        _addIngredientToBurger(burger, itemToAdd);
        return burger;
    }

    // 3. Side Cup + Cooked Fries/Sides
    const isCup = (i) => i.definitionId === 'side_cup';
    const isCookedSideReady = (i) => i.state && i.state.cook_level === 'cooked' && i.definition.result;

    let cup = null, cookedSide = null;
    if (isCup(held) && isCookedSideReady(target)) { cup = held; cookedSide = target; }
    else if (isCookedSideReady(held) && isCup(target)) { cookedSide = held; cup = target; }

    if (cup && cookedSide) {
        return new ItemInstance(cookedSide.definition.result);
    }

    // 4. Stacked Container Stacking
    if (held.definition.useStackRender && target.definition.useStackRender && held.definitionId === target.definitionId) {
        const heldContents = held.state.contents || [];
        const targetContents = target.state.contents || [];
        if (heldContents.length === 0 && targetContents.length === 0) {
            const targetCount = target.state.count || 1;
            const heldCount = held.state.count || 1;
            target.state.count = targetCount + heldCount;
            return target;
        }
    }

    // 5. Bag Packing
    const isBag = (i) => i.definitionId === 'bag' || i.definitionId === 'magic_bag';

    let bagBox = null, itemToPack = null;
    if (isBag(held)) { bagBox = held; itemToPack = target; }
    else if (isBag(target)) { bagBox = target; itemToPack = held; }

    if (bagBox && itemToPack) {
        const def = itemToPack.definition;
        let tag = null;
        if (def.category === 'burger' || itemToPack.definitionId.includes('burger')) {
            if (itemToPack.state.isWrapped) tag = 'burger';
        } else {
            const type = (def.orderConfig && def.orderConfig.type) || def.category;
            if (type === 'side' || type === 'drink') tag = type;
        }

        if (tag) {
            const contents = bagBox.state.contents || [];
            if (contents.length < 50) {
                bagBox.state.contents = [...contents, itemToPack];
                return bagBox;
            }
        }
    }

    // 6. Plate Combining
    if (held.definitionId === 'plate' && _canContainerHoldItem(held, target)) {
        if (!held.state.contents) held.state.contents = [];
        held.state.contents.push(target);
        return held;
    }
    if (target.definitionId === 'plate' && _canContainerHoldItem(target, held)) {
        if (!target.state.contents) target.state.contents = [];
        target.state.contents.push(held);
        return target;
    }

    return null;
};
