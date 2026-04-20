import { ASSETS, TILE_SIZE, TILE_TYPES } from '../constants.js';
import { DEFINITIONS } from '../data/definitions.js';
import { SPRITE_DEFINITIONS } from '../data/sprite_definitions.js';

export function drawPlayer(renderer, gameState) {
    if (gameState.player) {
        const player = gameState.player;
        const vx = player.visualX;
        const vy = player.visualY;
        const bob = player.walkBob || 0;
        const tilt = player.tilt || 0;

        renderer.ctx.save();
        // Translate to player center for tilt/bob
        const cx = vx * TILE_SIZE + TILE_SIZE / 2;
        const cy = vy * TILE_SIZE + TILE_SIZE / 2;
        renderer.ctx.translate(cx, cy + bob);
        renderer.ctx.rotate(tilt);
        renderer.ctx.translate(-cx, -cy);

        // Draw Player Base
        drawEntity(renderer, player.texture, vx, vy);

        // Draw Tool
        if (player.toolTexture) {
            const rotation = Math.atan2(player.facing.y, player.facing.x) + Math.PI / 2;
            drawRotatedEntity(renderer, player.toolTexture, vx, vy, rotation);
        }

        // Draw Held Item
        if (player.heldItem) {
            renderer.ctx.save();
            const nudge = 12;
            renderer.ctx.translate(player.facing.x * nudge, player.facing.y * nudge);
            drawEntity(renderer, player.heldItem, vx, vy);
            renderer.ctx.restore();
        }

        // Draw Held Appliance
        if (player.heldAppliance) {
            const app = player.heldAppliance;
            const texName = TILE_TYPES[app.tileType] ? TILE_TYPES[app.tileType].texture : null;
            if (texName) {
                const img = renderer.assetLoader.get(texName);
                if (img) {
                    renderer.ctx.drawImage(img, vx * TILE_SIZE, vy * TILE_SIZE - 20, TILE_SIZE, TILE_SIZE);
                }
            }

            if (app.attachedObject) {
                renderer.ctx.save();
                renderer.ctx.translate(0, -20);
                drawObject(renderer, app.attachedObject, vx, vy);
                renderer.ctx.restore();
            }
        }

        renderer.ctx.restore();
    }
}

/**
 * Returns true if this object should be drawn as a multi-tile large counter decoration.
 * Objects opt in by having widthTiles or heightTiles > 1 in their definition.
 */
export function isLargeCounterObject(object) {
    if (!object?.definition) return false;
    return (object.definition.widthTiles > 1) || (object.definition.heightTiles > 1);
}

/**
 * Draws a large counter object that spans multiple tiles.
 *
 * Positioning: the bottom of the image aligns with the bottom of a standard 64px counter
 * item. yOffset is the counter item lift (typically -29). For each extra tile of height
 * beyond the first, we shift up by one TILE_SIZE so the image grows upward from the
 * counter surface, not downward through the floor.
 *
 * To add a new large decoration:
 *   1. Add the item definition to items.json with widthTiles / heightTiles set
 *   2. Add its texture to ASSETS.OBJECTS in constants.js
 *   3. Add a pickup: () => true entry to interactions.js so it can't be picked up
 *   4. The render loop in Renderer.js will detect it automatically via isLargeCounterObject
 */
export function drawLargeCounterObject(renderer, object, x, y, yOffset = 0) {
    const def = object.definition;
    const widthTiles = def.widthTiles || 1;
    const heightTiles = def.heightTiles || 1;
    const img = renderer.assetLoader.get(object.texture);
    if (!img) return;

    const drawY = y * TILE_SIZE + yOffset - TILE_SIZE * (heightTiles - 1);
    renderer.ctx.drawImage(img, x * TILE_SIZE, drawY, TILE_SIZE * widthTiles, TILE_SIZE * heightTiles);
}

export function drawBoardRack(renderer, rackObject, x, y, yOffset = 0) {
    const boardCount = rackObject.state?.boardCount ?? 2;
    let textureName;
    if (boardCount >= 2) textureName = ASSETS.OBJECTS.BOARD_RACK_DOUBLE;
    else if (boardCount === 1) textureName = ASSETS.OBJECTS.BOARD_RACK_SINGLE;
    else textureName = ASSETS.OBJECTS.BOARD_RACK_EMPTY;

    const def = rackObject.definition;
    const widthTiles = def.widthTiles || 1;
    const heightTiles = def.heightTiles || 1;
    const img = renderer.assetLoader.get(textureName);
    if (!img) return;

    const drawY = y * TILE_SIZE + yOffset - TILE_SIZE * (heightTiles - 1);
    renderer.ctx.drawImage(img, x * TILE_SIZE, drawY, TILE_SIZE * widthTiles, TILE_SIZE * heightTiles);
}

export function drawBoardItem(renderer, boardObject, x, y, yOffset = 0) {
    let boardTexture = ASSETS.OBJECTS.BOARD;
    if (boardObject.definitionId === 'board_tomatoed') boardTexture = ASSETS.OBJECTS.BOARD_TOMATOED;
    else if (boardObject.definitionId === 'board_pickled') boardTexture = ASSETS.OBJECTS.BOARD_PICKLED;
    const img = renderer.assetLoader.get(boardTexture);
    if (img) {
        renderer.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE + yOffset, TILE_SIZE, TILE_SIZE);
    }

    const heldItem = boardObject.state?.heldItem;
    if (heldItem) {
        let scale = (heldItem.definition && (heldItem.definition.isSlice || heldItem.definition.isTopping)) ? 1.0 : 0.5;
        renderer.ctx.save();
        if (scale !== 1.0) {
            const cx = x * TILE_SIZE + TILE_SIZE / 2;
            const cy = y * TILE_SIZE + TILE_SIZE / 2 + yOffset;
            renderer.ctx.translate(cx, cy);
            renderer.ctx.scale(scale, scale);
            renderer.ctx.translate(-cx, -cy);
        }
        const itemImg = renderer.assetLoader.get(heldItem.texture);
        if (itemImg) {
            renderer.ctx.drawImage(itemImg, x * TILE_SIZE, y * TILE_SIZE + yOffset, TILE_SIZE, TILE_SIZE);
        }
        renderer.ctx.restore();

        if (heldItem.state?.count > 1) {
            renderer.drawTinyNumber(x, y, heldItem.state.count);
        }
    }
}

export function drawObject(renderer, object, x, y, overrideTexture = null, yOffset = 0) {
    if (!object) return;

    if (object.definitionId === 'board_rack_double') {
        drawBoardRack(renderer, object, x, y, yOffset);
        return;
    }

    if (object.definitionId === 'board' || object.definitionId === 'board_tomatoed' || object.definitionId === 'board_pickled') {
        drawBoardItem(renderer, object, x, y, yOffset);
        return;
    }

    if (isLargeCounterObject(object)) {
        drawLargeCounterObject(renderer, object, x, y, yOffset);
        return;
    }

    if (object.definitionId === 'soda_fountain') {
        drawSodaFountain(renderer, object, x, y, yOffset);
        return;
    }
    if (object.definitionId === 'bomb') {
        drawBomb(renderer, object, x, y, yOffset);
        return;
    }

    if (object.type === 'Composite' && object.definitionId !== 'burger_old' && (object.definitionId.includes('burger') || object.state.bun)) {
        drawBurger(renderer, object, x, y, yOffset);
        return;
    }

    if (object.type === 'Box') {
        drawBox(renderer, object, x, y, yOffset);
        return;
    }

    if (object.definition && object.definition.useStackRender) {
        drawStackedItem(renderer, object, x, y, 1.0, yOffset);
        return;
    }

    if (object.definitionId === 'dish_rack') {
        drawDishRack(renderer, object, x, y, yOffset);
        return;
    }

    const textureName = overrideTexture || object.texture;
    if (!textureName) return;
    const img = renderer.assetLoader.get(textureName);
    if (img) {
        renderer.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE + yOffset, TILE_SIZE, TILE_SIZE);
    }
}

export function drawSodaFountain(renderer, object, x, y, yOffset = 0) {
    let texture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;
    const status = object.state.status;

    if (status === 'full') texture = ASSETS.TILES.SODA_FOUNTAIN_FULL;
    else if (status === 'warning') texture = ASSETS.TILES.SODA_FOUNTAIN_WARNING;
    else if (status === 'filling') texture = ASSETS.TILES.SODA_FOUNTAIN_FILLING;
    else if (status === 'done') texture = ASSETS.TILES.SODA_FOUNTAIN_EMPTY;

    renderer.drawTile(texture, x, y, yOffset);

    if (status === 'full' || status === 'warning' || status === 'filling' || status === 'done') {
        const resultId = object.state.resultId;
        const drinkId = resultId || (object.state.syrupId ? DEFINITIONS[object.state.syrupId]?.result : null);

        if (drinkId && DEFINITIONS[drinkId] && DEFINITIONS[drinkId].sign) {
            renderer.drawTile(DEFINITIONS[drinkId].sign, x, y, yOffset);
        }
    }

    if (status === 'done') {
        drawEntity(renderer, ASSETS.OBJECTS.SODA, x, y);
    }
}


export function drawDishRack(renderer, rack, x, y, yOffset = 0) {
    const contents = rack.state.contents || [];
    const boards = rack.state.boards || [];
    const bx = x * TILE_SIZE;
    const by = y * TILE_SIZE + yOffset;

    renderer.drawTile(ASSETS.TILES.DISH_RACK_BASE, x, y, yOffset);

    const plateOffsets = [
        { dx: 12, dy: 12 }, { dx: 24, dy: 12 }, { dx: 36, dy: 12 },
        { dx: 12, dy: 28 }, { dx: 24, dy: 28 }, { dx: 36, dy: 28 }
    ];

    const row0Board = boards.find(b => b.row === 0);
    const row1Board = boards.find(b => b.row === 1);
    let plateIdx = 0;

    // Row 0 — board takes the row, otherwise fill with plates
    if (row0Board) {
        _drawBoardInRackRow(renderer, row0Board.item, bx, by, 12);
    } else {
        for (let i = 0; i < 3 && plateIdx < contents.length; i++, plateIdx++) {
            drawDishRackPlate(renderer, contents[plateIdx], bx + plateOffsets[i].dx, by + plateOffsets[i].dy);
        }
    }

    renderer.drawTile(ASSETS.TILES.DISH_RACK_LAYER1, x, y, yOffset);

    // Row 1 — board takes the row, otherwise continue filling plates
    if (row1Board) {
        _drawBoardInRackRow(renderer, row1Board.item, bx, by, 28);
    } else {
        for (let i = 3; i < 6 && plateIdx < contents.length; i++, plateIdx++) {
            drawDishRackPlate(renderer, contents[plateIdx], bx + plateOffsets[i].dx, by + plateOffsets[i].dy);
        }
    }

    renderer.drawTile(ASSETS.TILES.DISH_RACK_LAYER2, x, y, yOffset);
}

function _drawBoardInRackRow(renderer, boardItem, bx, by, rowDy) {
    let texKey = ASSETS.OBJECTS.BOARD;
    if (boardItem.definitionId === 'board_tomatoed') texKey = ASSETS.OBJECTS.BOARD_TOMATOED;
    else if (boardItem.definitionId === 'board_pickled') texKey = ASSETS.OBJECTS.BOARD_PICKLED;
    const img = renderer.assetLoader.get(texKey);
    if (img) {
        // Draw the board spanning the row: from x+10 wide enough to cover 3 plate slots
        renderer.ctx.drawImage(img, bx + 10, by + rowDy - 4, 48, 24);
    }
}

function drawDishRackPlate(renderer, plate, px, py) {
    const scale = 0.4;
    const size = TILE_SIZE * scale;
    const texture = plate.texture || 'plates/plate.png';
    const img = renderer.assetLoader.get(texture);
    if (img) {
        renderer.ctx.drawImage(img, px, py, size, size);
    }

    if (plate.definitionId === 'dirty_plate' && plate.state.dirtyLayers) {
        plate.state.dirtyLayers.forEach(layer => {
            const layerImg = renderer.assetLoader.get(layer.texture);
            if (layerImg) {
                renderer.ctx.save();
                renderer.ctx.translate(px + size / 2, py + size / 2);
                renderer.ctx.rotate(layer.rotation);
                renderer.ctx.drawImage(layerImg, -size / 2, -size / 2, size, size);
                renderer.ctx.restore();
            }
        });
    }
}

export function drawBox(renderer, object, x, y, yOffset = 0) {
    if (object.definition.textures) {
        const tex = object.getTexture();
        renderer.drawTile(tex, x, y, yOffset);
        return;
    }

    const boxTexture = object.getTexture();
    if (boxTexture) {
        renderer.drawTile(boxTexture, x, y, yOffset);
    }

    if (object.state.isOpen) {
        const def = DEFINITIONS[object.definitionId];
        if (def && def.produces) {
            const productDef = DEFINITIONS[def.produces];
            if (productDef) {
                let productTexture = productDef.texture;
                if (productDef.aging && object.state.age) {
                    if (object.state.age >= productDef.aging.spoilAge) {
                        const spoiledId = productDef.aging.spoiledItem;
                        if (spoiledId && DEFINITIONS[spoiledId]) {
                            productTexture = DEFINITIONS[spoiledId].texture;
                        }
                    } else if (productDef.aging.stages) {
                        const stages = productDef.aging.stages;
                        let maxStageDay = -1;
                        for (const [day, texture] of Object.entries(stages)) {
                            const dayNum = parseInt(day);
                            if (object.state.age >= dayNum && dayNum > maxStageDay) {
                                maxStageDay = dayNum;
                                productTexture = texture;
                            }
                        }
                    }
                }
                if (!productTexture && productDef.textures) {
                    productTexture = productDef.textures.base;
                }
                if (productTexture) {
                    const img = renderer.assetLoader.get(productTexture);
                    if (img) {
                        const scale = 0.75;
                        const size = TILE_SIZE * scale;
                        const offset = (TILE_SIZE - size) / 2;
                        renderer.ctx.drawImage(img, x * TILE_SIZE + offset, y * TILE_SIZE + offset + yOffset, size, size);
                    }
                }
            }
        }
    }
}

export function drawBurger(renderer, item, x, y, yOffset = 0) {
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE + yOffset;
    drawBurgerPixels(renderer, item, px, py);
}

export function drawBurgerPixels(renderer, item, px, py, scale = 1.0, ctx = renderer.ctx) {
    const drawSize = TILE_SIZE * scale;
    const assetLoader = renderer.assetLoader;

    if (item.state.isWrapped) {
        const wrappedImg = assetLoader.get(ASSETS.OBJECTS.BURGER_WRAPPED);
        if (wrappedImg) {
            ctx.drawImage(wrappedImg, px, py, drawSize, drawSize);
        }
        return;
    }

    let bottomTexName = ASSETS.OBJECTS.BUN_BOTTOM;
    let topTexName = ASSETS.OBJECTS.BUN_TOP;

    if (item.state.bun) {
        const bunDef = DEFINITIONS[item.state.bun.definitionId];
        if (bunDef) {
            if (bunDef.bottomTexture) bottomTexName = bunDef.bottomTexture;
            if (bunDef.topTexture) topTexName = bunDef.topTexture;
        }
    }

    const bunBottomImg = assetLoader.get(bottomTexName);
    if (bunBottomImg) {
        ctx.drawImage(bunBottomImg, px, py, drawSize, drawSize);
    }

    let layerYOffset = 0;

    const drawLayer = (objOrStr) => {
        let texName = null;
        let nudge = 0;

        if (objOrStr === 'mayo') {
            texName = ASSETS.OBJECTS.MAYO_PART;
            nudge = 0;
        } else if (typeof objOrStr === 'string') {
            if (DEFINITIONS[objOrStr]) {
                const def = DEFINITIONS[objOrStr];
                texName = def.partTexture || def.texture;
                nudge = def.nudge !== undefined ? def.nudge : 2;
            } else {
                texName = objOrStr;
            }
        } else if (typeof objOrStr === 'object') {
            const item = objOrStr;
            if (item.definitionId && DEFINITIONS[item.definitionId]) {
                const def = DEFINITIONS[item.definitionId];
                texName = def.partTexture || def.texture;
                if (def.nudge !== undefined) nudge = def.nudge;
                else if (item.definitionId === 'beef_patty') nudge = 5;
                else nudge = 2;
            } else {
                texName = item.texture || (item.getTexture ? item.getTexture() : null);
            }
        }

        nudge = nudge * scale;

        if (texName) {
            const img = assetLoader.get(texName);
            if (img) {
                ctx.drawImage(img, px, py - layerYOffset, drawSize, drawSize);
                layerYOffset += nudge;
            }
        }
    };

    if (item.state.toppings && Array.isArray(item.state.toppings)) {
        item.state.toppings.forEach(t => { if (t) drawLayer(t); });
    }

    const bunTopImg = assetLoader.get(topTexName);
    if (bunTopImg) {
        ctx.drawImage(bunTopImg, px, py - layerYOffset, drawSize, drawSize);
    }
}

export function drawStackedItem(renderer, item, x, y, scale = 1.0, yOffset = 0) {
    const def = item.definition;
    const count = item.state.count || 1;
    const contents = item.state.contents;
    const ctx = renderer.ctx;
    const assetLoader = renderer.assetLoader;

    ctx.save();
    const cx = x * TILE_SIZE + TILE_SIZE / 2;
    const cy = y * TILE_SIZE + TILE_SIZE / 2 + yOffset;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const baseX = -TILE_SIZE / 2;
    const baseY = -TILE_SIZE / 2;

    const partTexture = def.partTexture;
    const fullTexture = def.texture;
    const stackNudge = def.stackNudge || 6;
    const contentNudge = def.contentNudge || 12;

    for (let i = count - 1; i >= 0; i--) {
        const isTop = (i === count - 1);
        const nudgeY = i * -stackNudge;

        if (isTop) {
            const imgFull = assetLoader.get(fullTexture);
            if (imgFull) ctx.drawImage(imgFull, baseX, baseY + nudgeY, TILE_SIZE, TILE_SIZE);

            if (def.id === 'dirty_plate') {
                const layers = item.state.dirtyLayers || [];
                const contentY = baseY + nudgeY;
                layers.forEach(layer => {
                    const img = assetLoader.get(layer.texture);
                    if (img) {
                        ctx.save();
                        ctx.translate(baseX + TILE_SIZE / 2, contentY + TILE_SIZE / 2);
                        ctx.rotate(layer.rotation);
                        ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
                        ctx.restore();
                    }
                });
            }

            if (contents && contents.length > 0) {
                if (def.id === 'plate' || def.id === 'dirty_plate') {
                    const burger = contents.find(c => (c.definition && (c.definition.category === 'burger' || c.definitionId.includes('burger'))) || c.category === 'burger');
                    const side = contents.find(c => c.definition && c.definition.category === 'side_prep');
                    
                    let innerScale = 0.55;
                    let burgerX = - (TILE_SIZE * innerScale) + 4;
                    const contentY = baseY + nudgeY - contentNudge;

                    if (burger && !side) {
                        innerScale = 0.7;
                        burgerX = -(TILE_SIZE * innerScale) / 2;
                    }

                    const innerSize = TILE_SIZE * innerScale;

                    if (side) {
                        // Sides always use the smaller scale and default position for now
                        const sideScale = 0.55;
                        const sideSize = TILE_SIZE * sideScale;
                        if (side.definitionId === 'raw_fries' || side.definitionId === 'raw_sweet_potato_fries') {
                            const plateFriesImg = assetLoader.get('plates/fries-plate-part.png');
                            if (plateFriesImg) ctx.drawImage(plateFriesImg, baseX, baseY + nudgeY, TILE_SIZE, TILE_SIZE);
                            else {
                                const sImg = assetLoader.get(side.getTexture());
                                if (sImg) ctx.drawImage(sImg, 0, contentY + 10, sideSize, sideSize);
                            }
                        } else {
                            const sImg = assetLoader.get(side.getTexture());
                            if (sImg) ctx.drawImage(sImg, 0, contentY + 10, sideSize, sideSize);
                        }
                    }
                    if (burger) drawBurgerPixels(renderer, burger, burgerX, contentY + 15, innerScale);
                } else {
                    const firstContent = contents[0];
                    let cTex = firstContent.texture || (firstContent.definitionId && DEFINITIONS[firstContent.definitionId]?.texture) || (DEFINITIONS[firstContent]?.texture);
                    if (cTex) {
                        const img = assetLoader.get(cTex);
                        if (img) ctx.drawImage(img, baseX, baseY + nudgeY - contentNudge, TILE_SIZE, TILE_SIZE);
                    }
                }
            }

            if (partTexture) {
                const img = assetLoader.get(partTexture);
                if (img) ctx.drawImage(img, baseX, baseY + nudgeY, TILE_SIZE, TILE_SIZE);
            }

            if (def.showLabel !== false && contents && contents.length > 0 && contents[0].age === 1) {
                const img = assetLoader.get(def.labelAsset || ASSETS.UI.INSERT_LABEL);
                if (img) ctx.drawImage(img, baseX, baseY + nudgeY, TILE_SIZE, TILE_SIZE);
            }
        } else if (partTexture) {
            const img = assetLoader.get(partTexture);
            if (img) ctx.drawImage(img, baseX, baseY + nudgeY, TILE_SIZE, TILE_SIZE);
        }
    }
    ctx.restore();

    if (contents && contents.length > 0 && !['plate', 'dirty_plate'].includes(def.id) && def.showLabel !== false) {
        renderer.drawTinyNumber(x, y, contents.length);
    }
}

export function drawEntity(renderer, itemOrTexture, x, y, scale = 1.0) {
    if (!itemOrTexture) return;

    if (scale !== 1.0) {
        renderer.ctx.save();
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        renderer.ctx.translate(cx, cy);
        renderer.ctx.scale(scale, scale);
        renderer.ctx.translate(-cx, -cy);
    }

    if (typeof itemOrTexture === 'object' && itemOrTexture.definitionId) {
        const item = itemOrTexture;
        if (item.type === 'Composite' && item.definitionId !== 'burger_old' && (item.definitionId.includes('burger') || item.state.bun)) {
            drawBurger(renderer, item, x, y);
        } else if (item.type === 'Box') {
            drawBox(renderer, item, x, y);
        } else if (item.definitionId === 'dish_rack') {
            drawDishRack(renderer, item, x, y, 0);
        } else if (item.definitionId === 'insert' || (item.definition && item.definition.useStackRender)) {
            drawStackedItem(renderer, item, x, y, scale);
        } else if (item.definitionId === 'board' || item.definitionId === 'board_tomatoed' || item.definitionId === 'board_pickled') {
            drawBoardItem(renderer, item, x, y);
        } else {
            const img = renderer.assetLoader.get(item.texture);
            if (img) renderer.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    } else {
        const img = renderer.assetLoader.get(itemOrTexture);
        if (img) renderer.ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }

    if (scale !== 1.0) renderer.ctx.restore();
}

export function drawRotatedEntity(renderer, textureName, x, y, rotation) {
    if (!textureName) return;
    const img = renderer.assetLoader.get(textureName);
    if (img) {
        const centerX = x * TILE_SIZE + TILE_SIZE / 2;
        const centerY = y * TILE_SIZE + TILE_SIZE / 2;
        renderer.ctx.save();
        renderer.ctx.translate(centerX, centerY);
        renderer.ctx.rotate(rotation);
        renderer.ctx.drawImage(img, -TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        renderer.ctx.restore();
    }
}

export function drawAnimatedSprite(renderer, defId, x, y, startTime = 0, overridePixelX = null, overridePixelY = null) {
    const def = SPRITE_DEFINITIONS[defId];
    if (!def) return;
    const img = renderer.assetLoader.get(def.texture);
    if (!img) return;

    const elapsed = Date.now() - startTime;
    let frameIndex = 0;
    if (def.loop) {
        const period = def.frameCount * (def.duration || 100);
        frameIndex = Math.floor((elapsed % period) / (def.duration || 100));
    } else {
        frameIndex = Math.floor(elapsed / (def.duration || 100));
        if (frameIndex >= def.frameCount) frameIndex = def.frameCount - 1;
    }

    const fw = def.frameWidth;
    const fh = def.frameHeight;
    const sx = frameIndex * fw;
    
    let dx = overridePixelX !== null ? overridePixelX : x * TILE_SIZE + (TILE_SIZE - fw) / 2;
    let dy = overridePixelY !== null ? overridePixelY : y * TILE_SIZE + (TILE_SIZE - fh) / 2;

    renderer.ctx.drawImage(img, sx, 0, fw, fh, dx, dy, fw, fh);
}

export function drawBomb(renderer, object, x, y, yOffset = 0) {
    // Draw Base
    renderer.drawTile(ASSETS.OBJECTS.BOMB, x, y, yOffset);

    // Draw Outline with stepped flickering colors
    const time = Date.now() / 1000;
    
    // Use a fast-cycling palette for a "flicker" effect
    // 5 changes per second (time * 5)
    const palette = [
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
        '#ffff00', // Yellow
        '#00ff00', // Green
        '#ff3300', // Orange-Red
        '#ffffff'  // White flash
    ];
    
    const step = Math.floor(time * 5);
    const color = palette[step % palette.length];

    renderer.drawTintedTile(ASSETS.OBJECTS.BOMB_OUTLINE, x, y, color, yOffset);
}
