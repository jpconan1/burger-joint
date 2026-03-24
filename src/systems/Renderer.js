import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, ASSETS, TAG_LAYOUTS, TILE_TYPES } from '../constants.js';
import { drawStabilityMeter } from '../renderers/StabilityMeterRenderer.js';
import { DEFINITIONS } from '../data/definitions.js';
import { SPRITE_DEFINITIONS } from '../data/sprite_definitions.js';
import { TutorialOverlay } from '../renderers/TutorialOverlay.js';
import { ACTIONS, ALT_BINDINGS } from './Settings.js';
import * as ScreenRenderer from '../renderers/ScreenRenderer.js';
import * as TicketRenderer from '../renderers/TicketRenderer.js';
import * as ObjectRenderer from '../renderers/ObjectRenderer.js';
import * as UIRenderer from '../renderers/UIRenderer.js';
import * as EffectRenderer from '../renderers/EffectRenderer.js';





export class Renderer {
    constructor(canvasId, assetLoader) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = canvasId;
        this.ctx = this.canvas.getContext('2d');
        this.assetLoader = assetLoader;
        this.tutorialOverlay = new TutorialOverlay();

        // Offscreen canvas for world rendering (eliminates tile seams when scaled)
        this.worldCanvas = document.createElement('canvas');
        this.worldCtx = this.worldCanvas.getContext('2d');
        this.worldCanvasWidth = 0;
        this.worldCanvasHeight = 0;

        // Initialize canvas to full window size
        this.resizeCanvas();


        // Listen for window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Store offsets for other methods (like cursor) to use
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoomLevel = 1.0;

        document.getElementById('app').appendChild(this.canvas);
    }

    /**
     * Ensures the offscreen world canvas matches the current grid dimensions.
     * Called each frame to handle dynamic grid resizing.
     */
    ensureWorldCanvas(gridWidth, gridHeight) {
        const padding = TILE_SIZE; // Use TILE_SIZE as padding around the grid
        const requiredWidth = gridWidth * TILE_SIZE + padding * 2;
        const requiredHeight = gridHeight * TILE_SIZE + padding * 2;

        if (this.worldCanvasWidth !== requiredWidth || this.worldCanvasHeight !== requiredHeight) {
            this.worldCanvas.width = requiredWidth;
            this.worldCanvas.height = requiredHeight;
            this.worldCanvasWidth = requiredWidth;
            this.worldCanvasHeight = requiredHeight;
            // Reset image smoothing after resize
            this.worldCtx.imageSmoothingEnabled = false;
        }
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Pixel art style might need resetting after resize if context is cleared/reset
        this.ctx.imageSmoothingEnabled = false;
    }

    render(gameState) {
        // Ensure canvas fills window (rendering loop handling for robust resizing)
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
            this.resizeCanvas();
        }

        // Auto Zoom-to-Fit
        // We calculate the scale required to fit the entire grid into the window (minus some margin)
        // AND we cap it at 1.0 so we never upscale past native pixel art resolution (64x64 tiles).
        if (gameState.grid) {
            const margin = 40; // Breathing room in pixels
            const availableWidth = this.canvas.width - margin;
            const availableHeight = this.canvas.height - margin;

            const totalGridWidth = gameState.grid.width * TILE_SIZE;
            const totalGridHeight = gameState.grid.height * TILE_SIZE;

            const scaleX = availableWidth / totalGridWidth;
            const scaleY = availableHeight / totalGridHeight;

            this.zoomLevel = Math.min(scaleX, scaleY, 1.0);

            // Ensure offscreen canvas is sized correctly
            this.ensureWorldCanvas(gameState.grid.width, gameState.grid.height);
        }

        // --- Screen Shake Logic ---
        let shakeX = 0;
        let shakeY = 0;
        if (gameState.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * gameState.screenShake;
            shakeY = (Math.random() - 0.5) * gameState.screenShake;
            // Decay shake
            gameState.screenShake *= 0.9;
            if (gameState.screenShake < 0.1) gameState.screenShake = 0;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);

        // Calculate centering offsets (for final blit position)
        this.offsetX = 0;
        this.offsetY = 0;

        if (gameState.grid) {
            const gridPixelWidth = gameState.grid.width * TILE_SIZE * this.zoomLevel;
            const gridPixelHeight = gameState.grid.height * TILE_SIZE * this.zoomLevel;

            this.offsetX = Math.floor((this.canvas.width - gridPixelWidth) / 2);
            this.offsetY = Math.floor((this.canvas.height - gridPixelHeight) / 2);
        }

        // --- WORLD RENDERING (to offscreen canvas at native resolution) ---
        // Clear the offscreen canvas
        this.worldCtx.clearRect(0, 0, this.worldCanvas.width, this.worldCanvas.height);

        // Temporarily swap ctx to worldCtx for all world drawing
        const originalCtx = this.ctx;
        this.ctx = this.worldCtx;

        // Apply Padding Translation
        // We shift everything by TILE_SIZE so that (0,0) in grid logic lands at (PADDING, PADDING) in canvas
        // This allows items at negative coordinates (sticking up) to be visible.
        this.ctx.save();
        this.ctx.translate(TILE_SIZE, TILE_SIZE);

        // Helper to check for counter connections
        const isCounter = (id) => id === 'COUNTER' || id === 'SERVICE';
        const isGrill = (id) => id === 'GRILL';

        let serviceCounterIndex = 0;

        // 1. Draw Floor/Walls (Base Layer)
        const progressBars = [];

        // Pass 1: Draw ALL Floors/Walls first to avoid occlusion issues with 2.5D sorting
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = gameState.grid.getCell(x, y);
                // Rows 0 and 1 are the "wall rows", unless it's a transparent window
                const isWindow = cell.type.id === 'SERVICE_WINDOW';
                const baseTexture = (y < 2 && !isWindow) ? ASSETS.TILES.WALL : ASSETS.TILES.FLOOR;
                this.drawTile(baseTexture, x, y);
            }
        }
        // 1.5 Draw Game Border (Moved here to be behind objects)
        if (gameState.grid) {
            const gridPixelWidth = gameState.grid.width * TILE_SIZE;
            const gridPixelHeight = gameState.grid.height * TILE_SIZE;

            // Helper to draw a side piece masked to a specific length
            const drawSide = (textureName, x, y, length, isVertical) => {
                const img = this.assetLoader.get(textureName);
                if (!img) return;

                if (isVertical) {
                    // Vertical Side (Left/Right)
                    // Clip height to 'length'
                    // Draw at (x, y) with full width, clipped height
                    this.ctx.drawImage(img,
                        0, 0, img.width, length, // Source
                        x, y, img.width, length  // Destination
                    );
                } else {
                    // Horizontal Side (Top/Bottom)
                    // Clip width to 'length'
                    this.ctx.drawImage(img,
                        0, 0, length, img.height, // Source
                        x, y, length, img.height  // Destination
                    );
                }
            };

            // Helper to draw a corner
            const drawCorner = (textureName, x, y) => {
                const img = this.assetLoader.get(textureName);
                if (img) this.ctx.drawImage(img, x, y);
            };

            // Fetch dimensions for positioning (using one of the images to determine thickness)
            // We assume the corners and sides line up. 
            // Top/Bottom thickness = height of top/bottom images
            // Left/Right thickness = width of left/right images
            const topImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_TOP);
            const leftImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_LEFT);
            // Even if they aren't loaded yet, the loop will just skip or draw nothing, 
            // but we need them for offset calc.

            if (topImg && leftImg) {
                const topHeight = topImg.height;
                const leftWidth = leftImg.width;

                // We also need right/bottom dimensions for full box, but usually symmetry applies.
                // Let's get them to be safe or assume symmetry if needed.
                const rightImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_RIGHT);
                const bottomImg = this.assetLoader.get(ASSETS.UI.GAME_BORDER_BOTTOM);
                // const rightWidth = rightImg ? rightImg.width : leftWidth;
                // const bottomHeight = bottomImg ? bottomImg.height : topHeight;

                // Bring the border in by one tile, then push it out 8px
                const inset = TILE_SIZE - 7;

                // Calculate the "inner" rectangle that the border edges should adhere to
                const innerX = inset;
                const innerY = inset;
                const innerWidth = gridPixelWidth - (inset * 2);
                const innerHeight = gridPixelHeight - (inset * 2);

                // 1. Draw Sides
                // Top (centered on X grid, above Y of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_TOP, innerX, innerY - topHeight, innerWidth, false);

                // Bottom (centered on X grid, below Y of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_BOTTOM, innerX, innerY + innerHeight, innerWidth, false);

                // Left (centered on Y grid, left of X of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_LEFT, innerX - leftWidth, innerY, innerHeight, true);

                // Right (centered on Y grid, right of X of inner rect)
                drawSide(ASSETS.UI.GAME_BORDER_RIGHT, innerX + innerWidth, innerY, innerHeight, true);

                // 2. Draw Corners
                // Top-Left
                drawCorner(ASSETS.UI.GAME_BORDER_TOP_LEFT, innerX - leftWidth, innerY - topHeight);

                // Top-Right
                drawCorner(ASSETS.UI.GAME_BORDER_TOP_RIGHT, innerX + innerWidth, innerY - topHeight);

                // Bottom-Left
                drawCorner(ASSETS.UI.GAME_BORDER_BOTTOM_LEFT, innerX - leftWidth, innerY + innerHeight);

                // Bottom-Right
                drawCorner(ASSETS.UI.GAME_BORDER_BOTTOM_RIGHT, innerX + innerWidth, innerY + innerHeight);
            }
        }
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                const cell = gameState.grid.getCell(x, y);

                // Layer 0: Floor drawn in Pass 1

                // Auto-tiling Logic for COUNTER and SERVICE base
                if ((cell.type.id === 'COUNTER' || cell.type.id === 'SERVICE') && !(cell.state && cell.state.texture)) {
                    // Calculate Bitmask
                    // N=1, E=2, S=4, W=8
                    let mask = 0;

                    // North
                    if ((y > 0 && isCounter(gameState.grid.getCell(x, y - 1).type.id)) || (y === 0 && cell.type.id === 'SERVICE')) mask |= 1;
                    // East
                    if (x < gameState.grid.width - 1 && isCounter(gameState.grid.getCell(x + 1, y).type.id)) mask |= 2;
                    // South
                    if (y < gameState.grid.height - 1 && isCounter(gameState.grid.getCell(x, y + 1).type.id)) mask |= 4;
                    // West
                    if (x > 0 && isCounter(gameState.grid.getCell(x - 1, y).type.id)) mask |= 8;

                    this.drawAutoTile(ASSETS.TILES.COUNTER_SHEET, x, y, mask, ASSETS.TILES.COUNTER);
                }

                if (cell.type.id === 'GRILL') {
                    // Auto-tiling Logic for GRILL (East-West only)
                    // Mask: West=1, East=2
                    // 0: Solo, 1: West Conn, 2: East Conn, 3: Pipe (Both)
                    let mask = 0;

                    // West
                    if (x > 0 && isGrill(gameState.grid.getCell(x - 1, y).type.id)) mask |= 1;
                    // East
                    if (x < gameState.grid.width - 1 && isGrill(gameState.grid.getCell(x + 1, y).type.id)) mask |= 2;

                    this.drawAutoTile(ASSETS.TILES.GRILL_SHEET, x, y, mask, ASSETS.TILES.STOVE_OFF);
                }

                let tileTexture = (cell.state && cell.state.texture) || cell.type.texture;
                
                // Prevent double-drawing COUNTER (handled by auto-tile above)
                if ((cell.type.id === 'COUNTER' || cell.type.id === 'SERVICE' || cell.type.id === 'GRILL') && !(cell.state && cell.state.texture)) {
                    tileTexture = null;
                }

                // If the tile is just a floor, we don't need to draw it again on top
                if (cell.type.id === 'FLOOR') {
                    tileTexture = null;
                }

                if (cell.type.id === 'TICKET_WHEEL') {
                    // Removed: Logic to show order on wheel (now handled by hanging tickets)
                }
                if (cell.type.id === 'GARBAGE') {
                    this.drawTile(ASSETS.TILES.GARBAGE, x, y);

                    if (cell.state && cell.state.trashedItem) {
                        const item = cell.state.trashedItem;
                        this.ctx.save();
                        const cx = x * TILE_SIZE + TILE_SIZE / 2;
                        const cy = y * TILE_SIZE + TILE_SIZE / 2 - 24; // Nudge up 50% (relative to center/height)
                        this.ctx.translate(cx, cy);
                        this.ctx.rotate(cell.state.trashedItemRotation || 0);
                        this.ctx.scale(0.75, 0.75);
                        this.drawObject(item, -0.5, -0.5);
                        this.ctx.restore();
                    }

                    this.drawTile(ASSETS.TILES.GARBAGE_FRONT, x, y);
                    tileTexture = null;
                }



                if (cell.type.id === 'CUTTING_BOARD') {
                    // 1. Manually Draw the Base Board
                    this.drawTile(ASSETS.TILES.CUTTING_BOARD, x, y);

                    // 2. Draw the Held Item on top
                    if (cell.state && cell.state.heldItem) {
                        const item = cell.state.heldItem;
                        let scale = 0.5;
                        if (item.definition && (item.definition.isSlice || item.definition.isTopping)) {
                            // Slices remain full size (assuming they are small enough or intended to match burger size)
                            scale = 1.0;
                        }
                        this.drawEntity(item, x, y, scale);
                        if (item.state && item.state.count > 1) {
                            this.drawTinyNumber(x, y, item.state.count);
                        }
                    } else if (cell.state) {
                        // Migration/Legacy Fallback
                        if (cell.state.status === 'has_tomato') {
                            const t = this.assetLoader.get(ASSETS.TILES.CUTTING_BOARD_TOMATO);
                            if (t) this.ctx.drawImage(t, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        } else if (cell.state.status === 'has_slice') {
                            const t = this.assetLoader.get(ASSETS.TILES.CUTTING_BOARD_SLICE);
                            if (t) this.ctx.drawImage(t, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                        }
                    }

                    // 3. Cancel the standard drawTile loop at the end so we don't draw over our work
                    tileTexture = null;
                }


                if (cell.type.id === 'FRYER' && cell.state) {
                    // Check for Item Cooking (Patty or Fries)
                    let isItemCooking = false;
                    let isFries = false;

                    if (cell.object) {
                        if (cell.object.definitionId === 'fries') isFries = true;

                        if (cell.object.definition && cell.object.definition.cooking) {
                            const stage = cell.object.state.cook_level || 'raw';
                            const stageDef = cell.object.definition.cooking.stages[stage];
                            if (stageDef && stageDef.cookMethod === 'fry') {
                                isItemCooking = true;
                            }
                        }

                        // Override logic based on object
                        if (isFries) {
                            if (cell.object.state.cook_level === 'cooked') {
                                // Draw base fryer under the result
                                if (cell.state.facing !== undefined) {
                                    this.drawRotatedTile(ASSETS.TILES.FRYER, x, y, cell.state.facing * (Math.PI / 2));
                                } else {
                                    this.drawTile(ASSETS.TILES.FRYER, x, y);
                                }
                                tileTexture = ASSETS.TILES.FRYER;
                            } else {
                                // Assume cooking or raw
                                tileTexture = ASSETS.TILES.FRYER_DOWN;
                            }
                        } else if (isItemCooking) {
                            // Generic item (Patty) - Basket Down (Empty visual, item drawn by drawProgressBar?? No item is hidden?)
                            // Wait, if item is cooking, usually we hide it or show basket down.
                            // Current logic showed BASKET_DOWN.
                            tileTexture = ASSETS.TILES.FRYER_BASKET_DOWN;
                        } else {
                            // Item present but not cooking (e.g. Cooked Patty)
                            // Default to Basket Up (Standard Fryer)
                        }
                    } else {
                        // Fallback for Legacy State
                        if (cell.state.status === 'loaded') tileTexture = ASSETS.TILES.FRYER_FRIES;
                        else if (cell.state.status === 'down') tileTexture = ASSETS.TILES.FRYER_DOWN;
                        else if (cell.state.status === 'done') tileTexture = ASSETS.TILES.FRYER;
                    }
                }

                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state) {
                    if (cell.state.status === 'empty') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;
                    else if (cell.state.status === 'full') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_FULL;
                    else if (cell.state.status === 'warning') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_WARNING;
                    else if (cell.state.status === 'filling') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_FILLING;
                    else if (cell.state.status === 'done') tileTexture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;
                }

                if (cell.type.id === 'SHUTTER_DOOR') {
                    if (cell.state && cell.state.hasOwnProperty('isOpen') && !cell.state.isOpen) {
                        tileTexture = ASSETS.TILES.SHUTTER_TILE_CLOSED;
                    }
                }

                if (cell.type.id === 'PRINTER') {
                    // Removed: Printer logic (now handled by hanging tickets)
                }
                if (cell.type.id === 'DISHWASHER') {
                    if (cell.state && cell.state.isOpen) {
                        tileTexture = ASSETS.TILES.DISHWASHER_OPEN;
                        // Fade if player is "behind" the tall dishwasher image
                        if (gameState.player) {
                            const px = Math.round(gameState.player.visualX);
                            const py = Math.round(gameState.player.visualY);
                            if (px === x && py === y - 1) {
                                this.ctx.globalAlpha = 0.5;
                            }
                        }
                    } else {
                        tileTexture = ASSETS.TILES.DISHWASHER_CLOSED;
                    }
                }

                if (cell.type.id === 'CHUTE') {
                    this.drawChuteSegment(ASSETS.TILES.CHUTE_BACK, x, y);
                    tileTexture = null;
                }

                if (cell.state && cell.state.facing !== undefined) {
                    const rotation = cell.state.facing * (Math.PI / 2);
                    this.drawRotatedTile(tileTexture, x, y, rotation);
                } else {
                    this.drawTile(tileTexture, x, y);
                }
                this.ctx.globalAlpha = 1.0;

                if (cell.type.id === 'SERVICE') {
                    // Deprecated: Service Timer (removed)
                }

                // 1.5 Draw Soda Fountain Sign (Overlay)
                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state && (cell.state.status === 'full' || cell.state.status === 'warning' || cell.state.status === 'filling' || cell.state.status === 'done')) {
                    const resultId = cell.state.resultId;
                    // Fallback to syrupId lookup if resultId missing (legacy support)
                    const drinkId = resultId || (cell.state.syrupId ? DEFINITIONS[cell.state.syrupId]?.result : null);

                    if (drinkId && DEFINITIONS[drinkId] && DEFINITIONS[drinkId].sign) {
                        const signTexture = DEFINITIONS[drinkId].sign;
                        if (cell.state.facing !== undefined) {
                            const rotation = cell.state.facing * (Math.PI / 2);
                            this.drawRotatedTile(signTexture, x, y, rotation);
                        } else {
                            this.drawTile(signTexture, x, y);
                        }
                    }
                }

                // 1.55 Draw Finished Soda (Overlay)
                if (cell.type.id === 'SODA_FOUNTAIN' && cell.state && cell.state.status === 'done') {
                    this.drawEntity(ASSETS.OBJECTS.SODA, x, y);
                }

                // Draw Locked Overlay on Custom Menu
                if (cell.type.id === 'MENU' && !gameState.isEndgameUnlocked) {
                    this.drawTile(ASSETS.TILES.LOCKED, x, y);
                }

                if (cell.object) {
                    let isFrying = false;
                    // Check exclusion for Fryer
                    if (cell.type.id === 'FRYER') {
                        if (cell.object.definitionId === 'fries') {
                            isFrying = true;
                        } else if (cell.object.definition && cell.object.definition.cooking) {
                            const stage = cell.object.state.cook_level || 'raw';
                            const stageDef = cell.object.definition.cooking.stages[stage];
                            if (stageDef && stageDef.cookMethod === 'fry') {
                                isFrying = true;
                            }
                        }
                    }

                    if (!isFrying) {
                        let overrideTexture = null;
                        // Check for Stove Cooking Texture Override
                        if (cell.type.id === 'GRILL' && cell.object && cell.object.definition.cookingTexture) {
                            // Only use override if currently "raw" (cooking process uses this state)
                            // If cooked, it usually switches to 'patty-cooked.png' via internal rules
                            if (cell.object.state.cook_level === 'raw') {
                                overrideTexture = cell.object.definition.cookingTexture;
                            }
                        }
                        let yOffset = 0;
                        if (cell.type.id === 'COUNTER' || cell.type.id === 'SERVICE') {
                            yOffset = -29;
                        }

                        let alpha = 1.0;
                        if (cell.type.id === 'COUNTER' || cell.type.id === 'SERVICE') {
                        if (gameState.player) {
                            const playerX = Math.round(gameState.player.visualX);
                            const playerY = Math.round(gameState.player.visualY);
                            if (playerX === x && playerY === y - 1) {
                                alpha = 0.5;
                            }
                        }

                            // If there is a service counter above this counter, fade items so we can see the service counter
                            if (y > 0) {
                                const tileAbove = gameState.grid.getCell(x, y - 1);
                                if (tileAbove && tileAbove.type.id === 'SERVICE') {
                                    alpha = 0.5;
                                }
                            }
                        }

                        this.ctx.globalAlpha = alpha;
                        ObjectRenderer.drawObject(this, cell.object, x, y, overrideTexture, yOffset);

                        this.ctx.globalAlpha = 1.0;
                    }

                    // Cooking Progress Bar (Stove)
                    if (cell.type.id === 'GRILL') {
                        const item = cell.object;
                        if (item.state && item.state.cookingProgress > 0 && item.state.cook_level === 'raw') {
                            let max = cell.state.cookingSpeed || 2000;
                            if (item.definition && item.definition.cooking && item.definition.cooking.stages) {
                                const stageDef = item.definition.cooking.stages[item.state.cook_level];
                                if (stageDef && stageDef.duration) {
                                    max = stageDef.duration;
                                }
                            }
                            const pct = Math.min(item.state.cookingProgress / max, 1);
                            progressBars.push({ x, y, pct });
                        }
                    }

                    // Cooking Progress Bar (Fryer Item)
                    if (isFrying) {
                        const item = cell.object;
                        const stage = item.state.cook_level || 'raw';
                        const stageDef = item.definition.cooking.stages[stage];
                        if (item.state.cookingProgress > 0) {
                            const max = stageDef.duration || 2000;
                            const pct = Math.min(item.state.cookingProgress / max, 1);
                            progressBars.push({ x, y, pct });
                        }
                    }
                }

                // 2.5 Draw Fryer Progress
                if (cell.type.id === 'FRYER') {
                    if (cell.state && cell.state.status === 'down') {
                        let max = cell.state.cookingSpeed || 2000;
                        if (cell.object && cell.object.definition && cell.object.definition.cooking) {
                            const stage = cell.object.state.cook_level || 'raw';
                            if (cell.object.definition.cooking.stages && cell.object.definition.cooking.stages[stage]) {
                                const stageDef = cell.object.definition.cooking.stages[stage];
                                if (stageDef.duration) max = stageDef.duration;
                            }
                        }
                        const pct = Math.min(cell.state.timer / max, 1);
                        progressBars.push({ x, y, pct });
                    }
                }

                // 2.6 Draw Soda Filling Progress
                if (cell.type.id === 'SODA_FOUNTAIN') {
                    if (cell.state && cell.state.status === 'filling') {
                        const max = cell.state.fillDuration || 3000;
                        const pct = Math.min((cell.state.timer || 0) / max, 1);
                        progressBars.push({ x, y, pct });
                    }
                }

                // 2.6.5 Draw Dishwasher Progress
                if (cell.type.id === 'DISHWASHER') {
                    if (cell.state && cell.state.status === 'washing') {
                        const max = 60000;
                        const pct = Math.min(1 - ((cell.state.timer || 0) / max), 1);
                        progressBars.push({ x, y, pct });
                    }
                }

                // 2.7 Draw Box Quantity (Disabled: Unlimited)
                /*
                if (cell.object && cell.object.type === 'Box' && cell.object.state) {
                    const count = cell.object.state.count;
                    if (count !== undefined) {
                        this.drawTinyNumber(x, y, count);
                    }
                }
                */

                // 2.8 Draw Service Counter Active Ticket Hints
                if (cell.type.id === 'SERVICE') {
                    // For service counters, we use the same offset as normal counters
                    this.drawServiceHint(x, y, gameState, cell.object, -29, serviceCounterIndex);
                    serviceCounterIndex++;
                }

                if (gameState.fallingBoxes && x === 0) {
                    gameState.fallingBoxes.forEach(box => {
                        if (y >= box.y - 1 && y <= box.y + 1) {
                            this.ctx.save();
                            this.ctx.beginPath();
                            this.ctx.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                            this.ctx.clip();
                            this.drawObject(box.item, x, box.y);
                            this.ctx.restore();
                        }
                    });
                }

                if (cell.type.id === 'CHUTE') {
                    this.drawChuteSegment(ASSETS.TILES.CHUTE_FRONT, x, y);
                }
            }

            // Draw Player if in this row (Z-sorting)
            if (gameState.player && Math.round(gameState.player.visualY) === y) {
                ObjectRenderer.drawPlayer(this, gameState);
            }

        }



        // 3. Draw Player: Handled in render loop (Z-sorted)



        // 3.5 Draw Lighting Effect
        if (gameState.grid) {
            const gridPixelWidth = gameState.grid.width * TILE_SIZE;
            const gridPixelHeight = gameState.grid.height * TILE_SIZE;

            if (gameState.lightingIntensity > 0) {
                this.drawLightingEffect(gridPixelWidth, gridPixelHeight, gameState.lightingIntensity);
            }

            if (gameState.timeFreezeTimer > 0) {
                this.drawTimeFreezeFilter(gridPixelWidth, gridPixelHeight, gameState);
            }
        }


        // Draw Defered Progress Bars (So they are on top of borders/lighting)
        progressBars.forEach(pb => {
            this.drawProgressBar(pb.x, pb.y, pb.pct);
        });

        EffectRenderer.drawEffects(this, gameState);

        TicketRenderer.drawHangingTickets(this, gameState);


        // --- END WORLD RENDERING ---

        // Restore translation
        this.ctx.restore();

        // Restore the original context (main canvas)
        this.ctx = originalCtx;

        // Blit the offscreen world canvas to the main canvas with scaling
        // This draws the entire world as a single scaled image, eliminating tile seams
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false; // Keep pixel art crisp

        // Calculate the screen position for the top-left of the GRID (not the canvas)
        // offsetX/Y is where Grid(0,0) should be.
        // The canvas image has Grid(0,0) at (TILE_SIZE, TILE_SIZE).
        // So we need to shift the draw position to compensate for the padding scaling.
        const paddingScreen = TILE_SIZE * this.zoomLevel;

        this.ctx.drawImage(
            this.worldCanvas,
            0, 0, this.worldCanvas.width, this.worldCanvas.height,  // Source (full offscreen canvas)
            this.offsetX - paddingScreen, this.offsetY - paddingScreen, // Destination position
            this.worldCanvas.width * this.zoomLevel,                 // Destination width (scaled)
            this.worldCanvas.height * this.zoomLevel                 // Destination height (scaled)
        );
        this.ctx.restore();

        // 4. Draw UI Overlays (Screen Space)
        if (gameState.isViewingOrders) {
            TicketRenderer.drawOrderTickets(this, gameState.orders || [], gameState.pickUpKey, gameState.penalty, gameState.possibleMenu);
        }


        // Draw Stability Meter
        drawStabilityMeter(this, gameState);

        // 5. Draw HUD (Screen Space)
        UIRenderer.drawHUD(this, gameState);

        // 6. Draw Floating Texts (World Space projected)
        if (gameState.floatingTexts) {
            UIRenderer.drawFloatingTexts(this, gameState.floatingTexts);
        }


        // 7. Computer Overlay (Screen Space)
        if (gameState.gameState === 'COMPUTER_ORDERING') {
            // this.renderComputerScreen(gameState);
        }
        if (gameState.gameState === 'RENO_SHOP') {
            ScreenRenderer.renderRenoScreen(this, gameState);
        }


        if (gameState.gameState === 'APPLIANCE_SWAP' && gameState.swappingState) {
            this.ctx.save();
            this.ctx.translate(this.offsetX, this.offsetY); // transform to grid
            this.ctx.scale(this.zoomLevel, this.zoomLevel);

            const { x, y } = gameState.swappingState;
            this.drawTile(ASSETS.UI.BUTTON_ARROWS, x, y);

            this.ctx.restore();
        }

        UIRenderer.drawControlsHelp(this, gameState);


        // Render Tutorial Overlay
        if (this.tutorialOverlay) {
            this.tutorialOverlay.render(this, gameState);
        }

        // Render Build Mode UI (Global Space)


        // 8. BOMB BREAKDOWN EFFECT (Layered on top of everything)
        if (gameState.bombEffectActive) {
            this.drawBombEffect(gameState);
        }

        this.ctx.restore(); // Restore shake/transform
    }

    drawBombEffect(gameState) {
        const ctx = this.ctx;
        const canvas = this.canvas;
        // Effect total duration is 1500ms
        const progress = 1.0 - (gameState.bombEffectTimer / 1500.0);
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Absolute screen space

        // 1. Calculate the Trapezoidal Mask (flat top matching window width)
        // Originating from the "Window" behind the counter (top center of the grid)
        const gridWidth = gameState.grid ? gameState.grid.width * TILE_SIZE * this.zoomLevel : canvas.width;
        const gridHeight = gameState.grid ? gameState.grid.height * TILE_SIZE * this.zoomLevel : canvas.height;
        
        // Window is central, slightly narrowed (12 tiles minus 10px on each side)
        const topWidth = (gridWidth * (12 / 16)) - 20; 
        const topLeftX = this.offsetX + (gridWidth * (2 / 16)) + 10;
        const topY = this.offsetY + 55;

        ctx.beginPath();
        ctx.moveTo(topLeftX, topY);
        ctx.lineTo(topLeftX + topWidth, topY);
        // Fan out extremely wide at the bottom (way past grid edges)
        ctx.lineTo(this.offsetX + gridWidth * 2.8, this.offsetY + gridHeight + 55);
        ctx.lineTo(this.offsetX - gridWidth * 1.8, this.offsetY + gridHeight + 55);
        ctx.closePath();
        ctx.clip();

        // Phase 1: Immediate White Flash (0% - 7%)
        if (progress < 0.07) {
            const flashOpacity = 1.0 - (progress / 0.07);
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Phase 2: Lingering Glow / Embers (7% - 100%)
        if (progress > 0.07) {
            const fadeOut = (progress - 0.07) / 0.93;
            
            // Subtle bloom (masked to triangle)
            ctx.fillStyle = `rgba(255, 255, 255, ${(1.0 - fadeOut) * 0.4})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Small glowing embers
            const t = Math.floor(progress * 100);
            for (let i = 0; i < 30; i++) {
                // Distribute embers within a wider area, clipping will handle the triangle shape
                const ex = (Math.sin(i * 13 + t/10) * 0.8 + 0.5) * canvas.width;
                const ey = (Math.cos(i * 7 + t/15) * 0.8 + 0.5) * canvas.height;
                ctx.fillStyle = i % 2 === 0 ? '#ffcc00' : '#ffffff';
                ctx.globalAlpha = 1.0 - fadeOut;
                ctx.fillRect(ex, ey, 3, 3);
            }
            ctx.globalAlpha = 1.0;
        }

        ctx.restore();
    }

    drawPlayer(gameState) {
        ObjectRenderer.drawPlayer(this, gameState);
    }


    findTileByType(gameState, typeId) {
        if (!gameState.grid) return null;
        for (let y = 0; y < gameState.grid.height; y++) {
            for (let x = 0; x < gameState.grid.width; x++) {
                if (gameState.grid.getCell(x, y).type.id === typeId) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    drawServiceTimer(gridX, gridY, percent) {
        UIRenderer.drawServiceTimer(this, gridX, gridY, percent);
    }


    drawProgressBar(x, y, percent) {
        UIRenderer.drawProgressBar(this, x, y, percent);
    }


    drawTile(textureName, x, y, yOffset = 0) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            const hOffset = TILE_SIZE - img.height;
            this.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE + hOffset + yOffset, img.width, img.height);
        }
    }

    drawBoilTile(textureName, x, y, yOffset = 0, frames = 3, isVertical = false) {
        const img = this.assetLoader.get(textureName);
        if (img) {
            const fh = isVertical ? img.height / frames : img.height;
            const hOffset = TILE_SIZE - fh;
            this.drawBoilTilePixels(textureName, x * TILE_SIZE, y * TILE_SIZE + yOffset + hOffset, frames, isVertical);
        }
    }

    drawBoilTilePixels(textureName, px, py, frames = 3, isVertical = false, dw = null, dh = null) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            const frameIndex = Math.floor(Date.now() / 150) % frames;
            const fw = isVertical ? img.width : img.width / frames;
            const fh = isVertical ? img.height / frames : img.height;
            const sx = isVertical ? 0 : frameIndex * fw;
            const sy = isVertical ? frameIndex * fh : 0;

            const targetW = dw !== null ? dw : fw;
            const targetH = dh !== null ? dh : fh;

            this.ctx.drawImage(img, sx, sy, fw, fh, px, py, targetW, targetH);
        }
    }

    drawTintedTile(textureName, x, y, color, yOffset = 0) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (!img) return;

        // Use an offscreen canvas for tinting to avoid bleeding into the main scene
        if (!this.tintCanvas) {
            this.tintCanvas = document.createElement('canvas');
            this.tintCtx = this.tintCanvas.getContext('2d');
        }

        if (this.tintCanvas.width !== img.width || this.tintCanvas.height !== img.height) {
            this.tintCanvas.width = img.width;
            this.tintCanvas.height = img.height;
        }

        this.tintCtx.clearRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
        this.tintCtx.drawImage(img, 0, 0);
        this.tintCtx.globalCompositeOperation = 'source-in';
        this.tintCtx.fillStyle = color;
        this.tintCtx.fillRect(0, 0, this.tintCanvas.width, this.tintCanvas.height);
        this.tintCtx.globalCompositeOperation = 'source-over';

        const hOffset = TILE_SIZE - img.height;
        this.ctx.drawImage(this.tintCanvas, x * TILE_SIZE, y * TILE_SIZE + hOffset + yOffset, img.width, img.height);
    }

    drawChuteSegment(textureName, x, y) {
        const img = this.assetLoader.get(textureName);
        if (!img) return;

        // The chute now starts at row 0 (extended)
        const segmentHeight = TILE_SIZE;
        const sourceY = y * segmentHeight;

        // Safety check in case image is shorter than expected or y is out of range
        if (sourceY >= img.height) return;

        this.ctx.drawImage(
            img,
            0, sourceY, img.width, segmentHeight,
            x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE
        );
    }

    drawSodaFountain(object, x, y, yOffset = 0) {
        ObjectRenderer.drawSodaFountain(this, object, x, y, yOffset);
    }


    drawDispenser(object, x, y, yOffset = 0) {
        ObjectRenderer.drawDispenser(this, object, x, y, yOffset);
    }


    drawObject(object, x, y, overrideTexture = null, yOffset = 0) {
        ObjectRenderer.drawObject(this, object, x, y, overrideTexture, yOffset);
    }


    drawDishRack(rack, x, y, yOffset = 0) {
        ObjectRenderer.drawDishRack(this, rack, x, y, yOffset);
    }


    drawDishRackPlate(plate, px, py) {
        // Internal helper, not used by ObjectRenderer anymore
    }


    drawBox(object, x, y, yOffset = 0) {
        ObjectRenderer.drawBox(this, object, x, y, yOffset);
    }


    drawAutoTile(sheetName, x, y, mask, fallbackTexture) {
        const img = this.assetLoader.get(sheetName);
        if (!img) {
            // Fallback to single tile if sheet not found
            if (fallbackTexture) this.drawTile(fallbackTexture, x, y);
            return;
        }

        // Calculate source coordinates
        // Grid is 4x4.
        // Col = mask % 4
        // Row = floor(mask / 4)
        const col = mask % 4;
        const row = Math.floor(mask / 4);

        const sx = col * TILE_SIZE;
        const sy = row * TILE_SIZE;

        this.ctx.drawImage(img,
            sx, sy, TILE_SIZE, TILE_SIZE, // Source (Sheet)
            x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE // Destination (Canvas)
        );
    }

    drawStackedItem(item, x, y, scale = 1.0, yOffset = 0) {
        ObjectRenderer.drawStackedItem(this, item, x, y, scale, yOffset);
    }


    drawRotatedTile(textureName, x, y, rotation) {
        if (!textureName) return;
        const img = this.assetLoader.get(textureName);
        if (img) {
            const centerX = x * TILE_SIZE + TILE_SIZE / 2;
            const centerY = y * TILE_SIZE + TILE_SIZE / 2;

            this.ctx.save();
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate(rotation);
            this.ctx.drawImage(img, -img.width / 2, TILE_SIZE / 2 - img.height, img.width, img.height);
            this.ctx.restore();
        }
    }

    drawEntity(itemOrTexture, x, y, scale = 1.0) {
        ObjectRenderer.drawEntity(this, itemOrTexture, x, y, scale);
    }


    drawRotatedEntity(textureName, x, y, rotation) {
        ObjectRenderer.drawRotatedEntity(this, textureName, x, y, rotation);
    }


    drawAnimatedSprite(defId, x, y, startTime = 0, overridePixelX = null, overridePixelY = null) {
        ObjectRenderer.drawAnimatedSprite(this, defId, x, y, startTime, overridePixelX, overridePixelY);
    }




    renderTitleScreen(selection = 0) {
        ScreenRenderer.renderTitleScreen(this, selection);
    }


    renderSettingsMenu(state, settings) {
        ScreenRenderer.renderSettingsMenu(this, state, settings);
    }


    drawOrderTickets(orders, pickUpKey, penalty, menuItems) {
        TicketRenderer.drawOrderTickets(this, orders, pickUpKey, penalty, menuItems);
    }


    drawSingleTicket(img, x, y, w, h, angle, order) {
        TicketRenderer.drawSingleTicket(this, img, x, y, w, h, angle, order);
    }


    drawLightingEffect(width, height, opacity = 1.0) {
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * opacity})`;

        // Left Triangle (Top-heavy shadow to create downward light beam)
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(width * 0.3, 0);
        this.ctx.lineTo(0, height);
        this.ctx.fill();

        // Right Triangle
        this.ctx.beginPath();
        this.ctx.moveTo(width, 0);
        this.ctx.lineTo(width * 0.7, 0);
        this.ctx.lineTo(width, height);
        this.ctx.fill();

        this.ctx.restore();
    }

    drawTimeFreezeFilter(width, height, gameState) {
        const ps = gameState.powerupSystem;
        if (!ps) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
            this.ctx.fillRect(0, 0, width, height);
            this.ctx.restore();
            return;
        }

        const remaining = ps.AUTO_RESUME_DURATION - ps.autoResumeTimer;
        let opacity = 0.2;
        let shouldDraw = true;

        if (remaining <= 1500) {
            // Fast blink: 150ms cycle
            shouldDraw = Math.floor(Date.now() / 150) % 2 === 0;
        } else if (remaining <= 5000) {
            // Slow blink: 500ms cycle
            shouldDraw = Math.floor(Date.now() / 500) % 2 === 0;
        }

        if (shouldDraw) {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(0, 100, 255, ${opacity})`;
            this.ctx.fillRect(0, 0, width, height);
            this.ctx.restore();
        }
    }


    drawControlsHelp(gameState) {
        UIRenderer.drawControlsHelp(this, gameState);
    }


    drawHUD(gameState) {
        UIRenderer.drawHUD(this, gameState);
    }



    drawPauseButton(gameState) {
        UIRenderer.drawPauseButton(this, gameState);
    }


    renderPauseScreen(gameState) {
        ScreenRenderer.renderPauseScreen(this, gameState);
    }






    drawFloatingTexts(texts) {
        UIRenderer.drawFloatingTexts(this, texts);
    }


    drawTinyNumber(gridX, gridY, number) {
        UIRenderer.drawTinyNumber(this, gridX, gridY, number);
    }








    renderRenoScreen(gameState) {
        ScreenRenderer.renderRenoScreen(this, gameState);
    }


    drawServiceHint(x, y, gameState, cellObject, yOffset = 0, ticketIndex = 0) {
        UIRenderer.drawServiceHint(this, x, y, gameState, cellObject, yOffset, ticketIndex);
    }


    drawProgressTag(type, x, y, current, total, isError = false, yOffset = 0) {
        UIRenderer.drawProgressTag(this, type, x, y, current, total, isError, yOffset);
    }


    drawBurger(item, x, y, yOffset = 0) {
        ObjectRenderer.drawBurger(this, item, x, y, yOffset);
    }


    drawBurgerPixels(item, px, py, scale = 1.0, ctx = this.ctx) {
        ObjectRenderer.drawBurgerPixels(this, item, px, py, scale, ctx);
    }



    drawHangingTickets(gameState) {
        TicketRenderer.drawHangingTickets(this, gameState);
    }




    drawEffects(gameState) {
        EffectRenderer.drawEffects(this, gameState);
    }

}
