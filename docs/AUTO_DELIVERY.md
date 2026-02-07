# Auto-Delivery System Documentation

## Overview
The Auto-Delivery System is responsible for restocking the kitchen with essential supplies at the start of each day. It analyzes the current menu, checks existing inventory, and automatically orders the necessary ingredients and packaging to ensure the restaurant can serve the projected number of customers.

## Logic Flow

The process is split into two phases: **Calculation** (Post-Day) and **Delivery** (Start-Day).

### Phase 1: Calculation (`PostDaySystem.calculateAutoRestock`)

Triggered when the player clicks "Next Day" in the Post-Day menu.

1.  **Project Targets**:
    *   Calculates `TargetServings` based on customer count (`10 + Day * 3`) multiplied by a safety factor (1.5).
    *   Example: Day 5 = 25 customers -> ~38 servings target.

2.  **Menu Analysis**:
    *   Scans `Game.menuSystem.getMenu()`:
        *   **Burgers**: Registers needs for Buns + All active Toppings.
        *   **Sides**: Registers needs for Side Items (e.g., Potatoes) + `side_cup_box`.
        *   **Drinks**: Registers needs for Syrups + `drink_cup_box`.
    *   **Essentials**: Always registers need for `bun_box`, `patty_box`, `wrapper_box`, `bag_box`.

3.  **Dependency Tracing**:
    *   Uses `Game.itemDependencyMap` to trace ingredients back to their purchasing source (The Box).
    *   *Example*: `coke` (Drink) -> `coke_syrup` (Ingredient) -> `syrup_box` (Supply Box).

4.  **Inventory Audit**:
    *   Calls `getDetailedInventoryCount` for each needed supply.
    *   **Scans**: all rooms (shelves, counters), contents of Bags/Inserts, and **Charges** in Dispensers/Fountains.
    *   **Excludes**: Items currently sitting on `DELIVERY_TILE`s (as these are cleared before delivery).

5.  **Order Generation**:
    *   Calculates `Deficit = Target - Inventory`.
    *   If `Deficit > 0`, adds the item to the shopping list.
    *   **Restriction**: Limits ordering to **Max 1 Box** per type per day to prevent storage overflows.
    *   **Sorting**: Sorts the final list by `InventoryCount` (ascending). Items you are most critical on are ordered first.

6.  **Output**:
    *   Populates `Game.pendingOrders` with the prioritized list.

### Phase 2: Delivery (`Game.startDay`)

Triggered immediately after calculation, when the day transition begins.

1.  **Clear Loading Dock**:
    *   Scans `store_room` and `office`.
    *   Identifies all tiles with type `DELIVERY_TILE`.
    *   **Deletes** any object currently sitting on these tiles.

2.  **Unload Truck**:
    *   Iterates through `Game.pendingOrders`.
    *   Finds the first empty `DELIVERY_TILE`.
    *   Spawns the item (Box).
    *   Stops if no empty tiles remain (`"Delivery Area Full!"`).

## Troubleshooting

### Issue: "I'm not getting syrups/cups!"
If specific items are not showing up, check the following:

1.  **Menu Check**: Ensure the item is actually on the active menu. If `Game.menuSystem.getMenu().drinks` is empty (e.g., because you don't have a Soda Fountain yet), needs won't be calculated.
2.  **Dependency Chain**: The system must be able to trace the Menu Item back to a Box.
    *   Check `src/data/items.json`:
        *   Does the Drink have a `result` pointing to it from a Syrup?
        *   Does the Syrup have a `produces` field pointing to it from a Box?
    *   *Diagnostic*: In console, check `game.itemDependencyMap['your_drink_id']`. It should return the ID of the syrup/ingredient. Then check that ID to see if it points to a Box.
3.  **Inventory Ghosting**: Ensure `DELIVERY_TILE` exclusion is working. If the game thinks you have 50 cups sitting on the loading dock, it won't order more. The new logic (ignoring those tiles) generally fixes this.

## Configuration
*   **Safety Factor**: Adjusted in `PostDaySystem.js` (`const safetyFactor = 1.5;`). Increase to stockpile more.
*   **Delivery Limit**: Currently hardcoded to 1 box/type. Search "User Restriction" in `PostDaySystem.js` to remove.
