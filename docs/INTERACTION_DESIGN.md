# Interaction System Design

## Philosophy
The interaction system is designed to be "smart" and context-aware to ensure fluid gameplay with minimal inputs. Interactions should "do what the user expects" based on context.

## Container Logic
"Containers" include **Boxes**, **Stacks of Inserts**, and **Bags**.

### 1. While Empty Handed & Targeting Container
*   **Pick Up**: Picks up the container itself (e.g., pick up the whole box of patties).
*   **Interact**: Takes **one item** from the container (e.g., grab a single patty from the box).

### 2. While Holding a Container
*   **Pick Up (Smart Drop)**:
    *   **Primary Action**: Tries to place the **entire container** on the target tile.
        *   *Example*: Placing a box of patties on an empty counter.
    *   **Fallback**: If the container **cannot** be placed on the target (e.g., target is a Grill, Fryer, or occupied space), the system falls back to the **Interact** logic.
        *   *Example*: Pressing 'Pick Up' while holding a Box of Patties over a **Grill** will dropping **one patty** onto the grill, because you cannot place a cardboard box on a grill.
*   **Interact**:
    *   Always deals **one item** from the container to the target.
    *   *Example*: Placing one patty on a grill, one basket of fries in a fryer, or one insert onto a counter from a stack.

## Implementation Notes
*   **Location**: `src/systems/InteractionSystem.js` and `src/systems/InteractionHandlers.js`
*   **`handle_container_deal`**: This handler in `InteractionHandlers.js` is the core logic for "dealing one item". It handles:
    *   Generating the item (from Box `produces`, Insert stack `pop`, etc.).
    *   Initializing state on appliances (e.g., setting Fryer status to 'down').
    *   **Important**: This handler supports stacks of inserts (dealing from the top defacto).
*   **Fallback Logic**: `InteractionSystem.handlePickUp` explicitly calls `handle_container_deal` if the standard placement logic fails. This enables the "Smart Drop" behavior.
