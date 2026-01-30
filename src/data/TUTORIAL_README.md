# Tutorial System Documentation

This directory contains the data configuration for the Tutorial Overlay system.

## How to Add Tutorial Steps

To add a new tutorial bubble, edit `src/data/tutorial_steps.js` and add a new object to the `TUTORIAL_STEPS` array.

### Step Configuration Object

Each step object requires the following properties:

- **`id`** *(string)*: A unique identifier for the step (e.g., `'refill_soda'`).
- **`text`** *(string)*: The text to display inside the bubble.
    - **Dynamic Keys**: You can use placeholders like `[ACTION_NAME]` to insert the current key binding for that action. 
    - Supported Actions: `[INTERACT]`, `[PICK_UP]`, `[MOVE_UP]`, `[MOVE_DOWN]`, `[MOVE_LEFT]`, `[MOVE_RIGHT]`, `[VIEW_ORDERS]`.
    - Example: `"Press [INTERACT] to start"` might render as `"Press E to start"` or `"Press ENTER to start"`.
- **`targetType`** *(string)*: The `TILE_TYPE` ID OR `ITEM_DEFINITION_ID` that this bubble should attach to. The system will scan the grid for all entities of this type.
    - **Note**: If you target an item ID (e.g. `'beef_patty'`), the system will also check if the player is holding that item. This allows bubbles to follow the player when they pick up the target item.
    - Examples: `'SODA_FOUNTAIN'`, `'STOVE'`, `'beef_patty'`, `'patty_box'`.
- **`predicate`** *(function)*: A function that determines *when* the bubble appears.
    - **Signature**: `(gameState, entity) => boolean`
    - **Returns**: `true` to show the bubble, `false` to hide it.
    - **Context**: You have access to the global `gameState` and the specific `entity` (cell/object) being targeted.

### Example

```javascript
{
    id: 'intro_fryer',
    text: "Drop Basket: [INTERACT]",
    targetType: 'FRYER',
    predicate: (gameState, entity) => {
        // Only show if the fryer is loaded but the basket is up (not cooking yet)
        return entity.state.status === 'loaded' && entity.state.status !== 'down';
    }
}
```javascript
{
    id: 'intro_fryer',
    text: "Drop Basket: [INTERACT]",
    targetType: 'FRYER',
    predicate: (gameState, entity) => {
        // Only show if the fryer is loaded but the basket is up (not cooking yet)
        return entity.state.status === 'loaded' && entity.state.status !== 'down';
    }
}
```

### Inline Images
You can include images in the text by referencing the asset filename within brackets ending in `.png`.
Example: `"Combine with [bun.png]!"`

This is useful for showing icons for ingredients or tools.


### Clearing/Completing Bubbles

There are two ways to clear a bubble:
1. **Transient (Predicate-based)**: The `predicate` returns `false`. This hides the bubble but allows it to reappear if the condition becomes true again.
2. **Permanent (Completion-based) [STANDARD]**: Use `completionPredicate` to mark a step as "done". Once completed, it will never show again during the session.

#### `completionPredicate`
- **Signature**: `(gameState) => boolean`
- **Description**: If this returns true, the step ID is added to a `completedSteps` list. The bubble is immediately hidden and will not be evaluated again.

Example:
```javascript
{
    id: 'pickup_item',
    text: 'Pick up!',
    targetType: 'BOX',
    // Mark complete when user picks it up
    completionPredicate: (gameState) => gameState.player.heldItem !== null, 
    predicate: (gameState) => true
}
```

## System Overview

The `TutorialOverlay` renderer (`src/renderers/TutorialOverlay.js`) consumes this data. 
1. It iterates through all steps every frame.
2. Finds valid targets based on `targetType`.
3. Runs the `predicate` function.
4. If true, it draws the bubble, replacing any `[ACTION]` keys with the user's actual settings.
