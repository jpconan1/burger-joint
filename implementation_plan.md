# Implementation Plan - iterated End of Day Sequence

This plan outlines the refactoring of the End of Day sequence, implementing a report-focused design, reward unlocking system, and integrating purchasing into the build mode.

## User Goals
1.  **Iterate End of Day (EOD) Sequence**: Improve the flow and logic of the post-day screen.
2.  **Reward System**:
    *   **Add Toppings**: Adds 2 new toppings to the unlocked pool (ensuring sauces appear consistently).
    *   **Add Side**: Costs 100. Places a Fryer. Unlocks a choice of side.
    *   **Add Drink**: Costs 200. Places a Soda Fountain. Unlocks a choice of drink.
3.  **Menu System**:
    *   Only show toppings from the "unlocked pool".
    *   Display "Complexity Score" as the price per burger, updating dynamically.
4.  **Renovation / Build Mode**:
    *   Deprecate the old "Reno Screen".
    *   Transition directly to Build Mode.
    *   Add purchasing capability to the Build Mode context menu.

## Proposed Changes

### 1. Game State & Data (`src/Game.js`)
*   **Unlock Tracking**: Utilize `shopItems` `unlocked` property as the source of truth for the "Unlocked Pool".
*   **Helper Methods**:
    *   `unlockRandomToppings(count)`: Unlocks `count` random toppings/sauces.
        *   *Sauce Logic*: If the ratio of unlocked sauces to total unlocked toppings is low, prioritize unlocking a sauce.
    *   `unlockSide(sideId)`: Unlocks a specific side.
    *   `unlockDrink(drinkId)`: Unlocks a specific drink.

### 2. Post Day System (`src/systems/PostDaySystem.js`)
*   **State Machine Update**:
    *   Add states: `SIDE_SELECTION`, `DRINK_SELECTION`.
*   **Reward Generation (`generateRewardOptions`)**:
    *   **Option 0 (Toppings)**: "Expand Toppings".
        *   Action: Call `unlockRandomToppings(2)`.
    *   **Option 1 (Side)**: "Add Side ($100)".
        *   Check: Money >= 100.
        *   Action: Deduct 100. Trigger `ConstructionSystem` to place Fryer. On completion, transition to `SIDE_SELECTION`.
    *   **Option 2 (Drink)**: "Add Drink ($200)".
        *   Check: Money >= 200.
        *   Action: Deduct 200. Trigger `ConstructionSystem` to place Soda Fountain. On completion, transition to `DRINK_SELECTION`.
*   **Sub-Selection States**:
    *   `SIDE_SELECTION`: Display locked sides. User picks one -> Unlock -> Continue.
    *   `DRINK_SELECTION`: Display locked drinks. User picks one -> Unlock -> Continue.

### 3. Menu System (`src/systems/MenuSystem.js`)
*   **Topping Filtering**: Update `processItems` or `getAvailableToppings`:
    *   Filter `toppings` list to only include items where `game.shopItems.find(i => i.id === t.id).unlocked` is true.
*   **Complexity / Price**:
    *   Update `calculateComplexity` to ensure it reflects the target pricing model.
    *   Update `renderComplexity` to label it "Price: $X".

### 4. Construction & Shop System
*   **`src/systems/ConstructionSystem.js`**:
    *   **Context Menu**: In `handleInput`, when interacting with `FLOOR` tiles:
        *   Add option: "Buy Appliance".
    *   **Buy Menu**: Implement a simple selection list (or reuse a mini-shop renderer) to list available appliances.
        *   On selection: Deduct money -> `enterBuildMode(item)` (Placement).
*   **`src/systems/ShopSystem.js`**:
    *   Deprecate/Remove `handleRenoInput` if it's no longer used.
    *   Ensure `handleComputerInput` (Supply Ordering) remains for the "Order Supplies" phase.

## Verification
*   **Test Rewards**:
    *   Verify "Add Toppings" increases the count of available toppings in the Menu.
    *   Verify "Add Side" deducts money, prompts Fryer placement, then asks to pick a Side.
    *   Verify "Add Drink" deducts money, prompts Fountain placement, then asks to pick a Drink.
*   **Test Menu**:
    *   Check custom burger menu only shows unlocked toppings.
    *   Check price updates as toppings are added.
*   **Test Build Mode**:
    *   Enter build mode, right-click/interact with floor, buy an appliance, place it.
