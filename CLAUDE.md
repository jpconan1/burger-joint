# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run preview  # Preview production build
```

No test runner is configured. No linter is configured.

## Architecture

This is a browser-based burger restaurant simulation game. It uses Vite with vanilla ES modules — no framework. Entry point: `src/main.js` → `new Game().init()`.

### Game (`src/Game.js`)
The central god object. All systems hold a `this.game` back-reference to reach shared state (grid, player, audioSystem, etc.). Game state machine: `'TITLE'` → `'PLAYING'` → `'SETTINGS'` (and post-day screens). The main loop calls `update(dt)` on all systems each frame.

Key game-level state: `isDayActive`, `isPrepTime`, `dayTimer`, `currentShift` (`'DAY'`/`'NIGHT'`), `lightingIntensity`, `ticketSpeedBonus`, `toppingCharges`.

### Systems (`src/systems/`)
- **ServiceCycle** — Day/night cycle, appliance updates, ticket pacing (Gaussian intensity curve with day/night peaks)
- **InputManager** — Keyboard/mouse input, held-key detection (500ms threshold for pick-up-appliance and swap actions)
- **OrderSystem** — Ticket generation, scoring, profit calculation
- **MenuSystem** — Tracks the restaurant's active menu (burger configs, sides, drinks)
- **Renderer** — Orchestrates all rendering; delegates to sub-renderers in `src/renderers/`
- **InteractionSystem** + **InteractionHandlers** — Dispatches player interactions via a lookup table in `src/data/interactions.js`. Priority order: tile-specific → container collect → container deal → item-specific → burger → fallback pickup
- **AlertSystem** — 9-slice popup windows with "line boil" animation
- **PowerupSystem**, **AudioSystem**, **TouchInputSystem**, **UISystem**, **Grid**, **Settings**

### Entities (`src/entities/`)
- **Player** — Grid position + visual position (interpolated), held item, facing direction, tilt/walk-bob juice
- **Item** (`ItemInstance`) — Wraps a `definitionId` + mutable `state` (toppings, cook_level, contents, etc.)

### Data (`src/data/`)
- **`items.json`** — Source of truth for all item definitions, loaded and hydrated by `definitions.js` into `DEFINITIONS`
- **`definitions.js`** — Exports `DEFINITIONS` (keyed by item id), `ItemType`, `CAPABILITY`
- **`interactions.js`** — Dispatch table mapping tile/item ids to handler functions
- **`defaultLevel.js`** — Hard-coded 16×11 grid layout
- **`scoringConfig.js`** / **`scoreConfig.json`** — Game pacing constants (ticket intervals, peak times, scoring multipliers)
- **`orderTemplates.js`** — Generates meal configs from active menu capabilities
- **`alerts.js`** — Alert popup definitions

### Renderers (`src/renderers/`)
Sub-renderers called by `Renderer.js`: `ScreenRenderer`, `TicketRenderer`, `ObjectRenderer`, `UIRenderer`, `EffectRenderer`, `StabilityMeterRenderer`, `TutorialOverlay`. Effects use sprite sheets (grill, dust, fire defined in `src/data/sprite_definitions.js`).

### Constants (`src/constants.js`)
Defines `TILE_SIZE` (64px), `GRID_WIDTH` (16), `GRID_HEIGHT` (11), `TILE_TYPES`, and the `ASSETS` path registry for all sprites/audio.

## Interaction System

The pick-up vs. interact distinction is core to gameplay:
- **Pick Up** (Space/binding): Pick up whole item or container. Held for 500ms → pick up appliance.
- **Interact** (binding): Deal one item from a container; interact with appliance.
- **Smart Drop**: Holding a container and pressing Pick Up over a tile that can't hold a container (e.g., grill) falls back to dealing one item — documented in `docs/INTERACTION_DESIGN.md`.

Container deal logic lives in `src/systems/interactions/CombineUtils.js` and `InteractionHandlers.js`.

## Adding New Items

1. Add a group entry to `src/data/items.json` (type: `supply_chain` for box+item pairs, or standalone)
2. Add asset path to `ASSETS.OBJECTS` in `src/constants.js`
3. Add interaction handlers to `src/data/interactions.js` if needed
4. Add topping ticket asset to `ASSETS.UI.TICKET_TOPPINGS` if it appears on order tickets

## Large Counter Objects (multi-tile decorations)

Some objects span more than one tile and use oversized sprites (e.g. 128×128 for a 2×2 tile object). The render system handles these automatically — no per-object render code needed.

### How it works

- `isLargeCounterObject(object)` in `src/renderers/ObjectRenderer.js` detects these by checking `definition.widthTiles > 1 || definition.heightTiles > 1`
- `drawLargeCounterObject(renderer, object, x, y, yOffset)` does the draw, aligning the image bottom with a standard counter item's bottom and growing upward
- `Renderer.js` defers their draw call to after the x-loop for their row, so adjacent counter tiles don't overdraw the overhanging portion
- The alpha (semi-opaque when player walks in front) automatically covers all spanned columns using `widthTiles`

### Asset sizing

Assets are loaded at native resolution when the path contains a `/` (e.g. `cutting_boards/board_rack-double.png`). Root-level paths (no `/`) are auto-scaled down to 64×64 by `AssetLoader`. Always use a subdirectory path for oversized sprites.

### Adding a new large counter object

1. **`src/data/items.json`** — add a `tool_supply` group with `"widthTiles": N, "heightTiles": N` on the item
2. **`src/constants.js`** — add the texture path to `ASSETS.OBJECTS` (use `subdir/filename.png` so it loads at native size)
3. **`src/data/interactions.js`** — add `'your_id': { interact: () => true, pickup: () => true }` to `ITEMS` so it can't be picked up
4. **`src/data/defaultLevel.js`** — place it as an `object` on a counter cell; the object spans rightward and upward from the anchor tile
5. That's it — `isLargeCounterObject` routes it through `drawLargeCounterObject` automatically

### Current large counter objects

| id | widthTiles | heightTiles | location in level |
|----|------------|-------------|-------------------|
| `board_rack_double` | 2 | 2 | row 10, col 4 (bottom counter row) |
