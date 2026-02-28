import { ACTIONS } from './Settings.js';
import { DEFINITIONS } from '../data/definitions.js';
import { ASSETS, TILE_SIZE } from '../constants.js';
import { ItemInstance } from '../entities/Item.js';

export class UnlockMiniGame {
    constructor(alertSystem, data) {
        this.alertSystem = alertSystem;
        this.game = alertSystem.game;
        this.rewards = data.rewards;
        this.onComplete = alertSystem.onComplete;

        // Clone existing burgers from MenuSystem
        const existingBurgers = this.game.menuSystem.menuSlots
            .filter(slot => slot !== null)
            .map(slot => JSON.parse(JSON.stringify(slot)));

        this.unlockState = {
            rewards: this.rewards,
            assignments: this.rewards.map(() => null), // null means unassigned
            tempBurgers: existingBurgers,
            selectionMode: 'piece', // 'piece', 'burger', 'finish'
            selectedIndex: 0, // piece index
            grabbedIndex: null,
            targetBurgerIndex: 0,
            lastSwappedIndex: null,
            error: null
        };

        this.initButtonFrames();
    }

    initButtonFrames() {
        // We no longer need to manually slice frames in JS.
        // The boiling effect is now handled via CSS classes.
    }

    getAssetUrl(assetKey) {
        if (!assetKey) return '';
        const asset = this.game.assetLoader.get(assetKey);
        if (!asset) return '';
        if (asset instanceof HTMLCanvasElement) return asset.toDataURL();
        if (asset instanceof HTMLImageElement) return asset.src;
        return '';
    }

    update(dt) {
        // No logic needed here currently as boiling is handled by CSS
    }

    start() {
        // Pre-load all potential topping textures to avoid lazy-loading flicker
        this.unlockState.rewards.forEach(reward => {
            const toppingId = this.getToppingId(reward);
            const toppingDef = DEFINITIONS[toppingId] || reward;
            const tex = toppingDef.partTexture || toppingDef.texture || (toppingDef.textures && (toppingDef.textures.base || toppingDef.textures.idle));
            if (tex) {
                this.game.renderer.assetLoader.get(tex);
            }
        });

        this.render();

        // Anti-lazy-loading hack: Re-render after a moment in case assets were loading
        setTimeout(() => {
            if (this.alertSystem.activeMiniGame === this) {
                this.render();
            }
        }, 300);
    }

    render() {
        if (!this.unlockState) return;

        // Set Size via AlertSystem
        const step = {
            size: { width: '800px', height: '600px' },
            position: 'center'
        };
        this.alertSystem.updateLayout(step);

        // FLIP: Record current positions BEFORE clearing
        const oldPos = new Map();
        if (this.rewardCardsMap && this.rewardCardsMap.size > 0) {
            this.unlockState.rewards.forEach(r => {
                const card = this.rewardCardsMap.get(r);
                if (card && card.offsetParent !== null) {
                    const rect = card.getBoundingClientRect();
                    oldPos.set(r, { left: rect.left, top: rect.top });
                }
            });
        }

        // Clear content
        this.alertSystem.contentText.innerHTML = '';
        this.alertSystem.buttonsContainer.innerHTML = '';
        this.alertSystem.nextBtn.style.display = 'none';
        this.alertSystem.portrait.style.display = 'none';

        // Header
        const header = document.createElement('div');
        header.style.fontSize = '24px';
        header.style.textAlign = 'center';
        header.style.marginBottom = '20px';
        header.innerHTML = 'NEW UNLOCKS! <br><span style="-webkit-text-stroke: 4px black; font-size: 16px;">Assign at least ONE topping to a burger. <br>Taking more adds a challenge! <br>Each burger must have a different total topping count!</span>';
        this.alertSystem.contentText.appendChild(header);

        // Rewards Pool
        if (!this.rewardsContainer) {
            this.rewardsContainer = document.createElement('div');
            this.rewardsContainer.style.display = 'flex';
            this.rewardsContainer.style.justifyContent = 'center';
            this.rewardsContainer.style.gap = '20px';
            this.rewardsContainer.style.marginBottom = '30px';
            this.rewardCardsMap = new Map();
        }



        this.unlockState.rewards.forEach((reward, i) => {
            const isAssigned = this.unlockState.assignments[i] !== null;
            const isSelected = this.unlockState.selectionMode === 'piece' && this.unlockState.selectedIndex === i;
            const isGrabbed = this.unlockState.grabbedIndex === i;

            let card = this.rewardCardsMap.get(reward);
            if (!card) {
                card = document.createElement('div');
                card.style.width = '80px';
                card.style.height = '80px';
                card.style.backgroundSize = '100% 100%';
                card.style.backgroundRepeat = 'no-repeat';
                card.style.borderRadius = '8px';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.alignItems = 'center';
                card.style.justifyContent = 'center';
                card.style.transition = 'transform 0.1s, opacity 0.1s, border 0.1s';
                card.style.pointerEvents = 'auto';
                card.style.imageRendering = 'pixelated';
                card.style.cursor = 'pointer';
                this.rewardCardsMap.set(reward, card);
            }

            // Pool Logic: Only show if NOT assigned and NOT grabbed (grabbed is handled by burger preview)
            if (!isAssigned && !isGrabbed) {
                this.rewardsContainer.appendChild(card);
            }

            // Clear old icons/labels before refreshing
            card.innerHTML = '';

            card.style.opacity = isAssigned ? '0.4' : '1';
            card.style.transform = (isSelected || isGrabbed) ? 'scale(1.1)' : 'scale(1)';
            card.style.border = (isSelected || isGrabbed) ? '4px solid #fff' : '4px solid transparent';

            // Hide assigned items in pool but keep them available for the burger display
            if (isAssigned && this.unlockState.selectionMode === 'piece' && !isGrabbed) {
                card.style.display = 'none';
            } else {
                card.style.display = 'flex';
            }

            // Reset positioning styles (might have been moved to a burger)
            card.style.position = 'relative';
            card.style.left = 'auto';
            card.style.top = 'auto';
            card.style.marginLeft = '0';
            card.style.zIndex = 'auto';

            if (isGrabbed) {
                card.classList.add('boiling-horizontal');
                card.style.backgroundImage = `url('/assets/ui/button_background-boil.png')`;
            } else {
                card.classList.remove('boiling-horizontal');
                card.style.backgroundImage = `url(${this.getAssetUrl('ui/button_background.png')})`;
                card.style.backgroundSize = '100% 100%';
            }



            card.onclick = (e) => {
                e.stopPropagation();
                this.unlockState.selectionMode = 'piece';
                this.unlockState.selectedIndex = i;
                this.render();
            };

            const toppingId = this.getToppingId(reward);
            const toppingDef = DEFINITIONS[toppingId] || reward;

            const icon = document.createElement('img');
            icon.src = this.getAssetUrl(toppingDef.texture || toppingDef.textures?.base);
            icon.style.width = '48px';
            icon.style.height = '48px';
            icon.style.imageRendering = 'pixelated';
            card.appendChild(icon);

            const label = document.createElement('div');
            label.textContent = reward.name;
            label.style.fontSize = '10px';
            label.style.textAlign = 'center';
            label.style.marginTop = '4px';
            label.style.webkitTextStroke = '3px black';
            card.appendChild(label);
        });

        // FLIP: Play animation
        requestAnimationFrame(() => {
            this.unlockState.rewards.forEach((r, i) => {
                const card = this.rewardCardsMap.get(r);
                if (!card || !oldPos.has(r)) return;

                const newRect = card.getBoundingClientRect();
                const oldP = oldPos.get(r);
                const deltaX = oldP.left - newRect.left;
                const deltaY = oldP.top - newRect.top;

                if (deltaX !== 0 || deltaY !== 0) {
                    const isSelected = this.unlockState.selectionMode === 'piece' && this.unlockState.selectedIndex === i;
                    const isGrabbed = this.unlockState.grabbedIndex === i;
                    const baseScale = (isSelected || isGrabbed) ? 1.1 : 1.0;

                    card.style.transition = 'none';
                    card.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${baseScale})`;
                    void card.offsetWidth; // force reflow
                    card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1.1), opacity 0.1s, border 0.1s';
                    card.style.transform = `translate(0px, 0px) scale(${baseScale})`;
                }
            });
        });

        this.alertSystem.contentText.appendChild(this.rewardsContainer);

        // Burgers List
        const burgersContainer = document.createElement('div');
        burgersContainer.style.display = 'flex';
        burgersContainer.style.overflowX = 'auto';
        burgersContainer.style.gap = '20px';
        burgersContainer.style.padding = '40px 20px 20px 20px';
        burgersContainer.style.backgroundColor = '#fff';
        burgersContainer.style.borderRadius = '12px';
        burgersContainer.style.minHeight = '200px';
        burgersContainer.style.border = '4px solid #f00';
        burgersContainer.style.position = 'relative';

        const burgerLabel = document.createElement('div');
        burgerLabel.textContent = 'Burger Menu!';
        burgerLabel.style.position = 'absolute';
        burgerLabel.style.top = '10px';
        burgerLabel.style.left = '15px';
        burgerLabel.style.fontSize = '18px';
        burgerLabel.style.fontWeight = '900';
        burgerLabel.style.color = '#f00';
        burgerLabel.style.fontFamily = "'Inter', sans-serif";
        burgersContainer.appendChild(burgerLabel);

        const counts = this.unlockState.tempBurgers.map((b, idx) => this.getIngredientCount(b, idx));
        const duplicateCountSet = new Set();
        counts.forEach((c, i) => {
            if (counts.indexOf(c) !== i) duplicateCountSet.add(c);
        });

        this.unlockState.tempBurgers.forEach((burger, i) => {
            const isSelected = this.unlockState.selectionMode === 'burger' && this.unlockState.targetBurgerIndex === i;
            const count = this.getIngredientCount(burger, i);
            const isConflict = duplicateCountSet.has(count);

            const bCard = document.createElement('div');
            bCard.style.minWidth = '220px';
            bCard.style.padding = '20px';
            bCard.style.backgroundSize = '100% 100%';
            bCard.style.backgroundRepeat = 'no-repeat';
            bCard.style.borderRadius = '8px';
            bCard.style.display = 'flex';
            bCard.style.flexDirection = 'column';
            bCard.style.alignItems = 'center';
            bCard.style.position = 'relative';
            bCard.style.pointerEvents = 'auto';
            bCard.style.border = isSelected ? '4px solid #fff' : (isConflict ? '4px solid #f00' : '4px solid transparent');
            bCard.style.imageRendering = 'pixelated';
            bCard.style.transition = 'transform 0.1s, border 0.1s';
            bCard.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';

            bCard.style.backgroundImage = `url('/assets/ui/ticket_bg.png')`;
            bCard.style.backgroundSize = '100% 100%';

            bCard.style.cursor = 'pointer';
            bCard.style.boxShadow = 'none'; // Remove any inherited shadows
            bCard.onclick = (e) => {
                e.stopPropagation();
                const pieceIdx = this.unlockState.selectedIndex;
                this.unlockState.assignments[pieceIdx] = i;
                this.unlockState.selectionMode = 'burger';
                this.unlockState.targetBurgerIndex = i;
                this.render();
            };

            const bName = document.createElement('div');
            bName.textContent = burger.name || `Burger ${i + 1}`;
            bName.style.fontSize = '12px';
            bName.style.marginBottom = '5px';
            bName.style.webkitTextStroke = '4px black';
            bName.style.zIndex = '1';
            bCard.appendChild(bName);

            // Resolve Bun Assets
            let bottomTexName = ASSETS.OBJECTS.BUN_BOTTOM;
            let topTexName = ASSETS.OBJECTS.BUN_TOP;

            if (burger.state.bun) {
                const bunDef = DEFINITIONS[burger.state.bun.definitionId];
                if (bunDef) {
                    if (bunDef.bottomTexture) bottomTexName = bunDef.bottomTexture;
                    if (bunDef.topTexture) topTexName = bunDef.topTexture;
                }
            }

            const topBun = document.createElement('img');
            topBun.src = this.getAssetUrl(topTexName);
            topBun.style.width = `${TILE_SIZE}px`;
            topBun.style.height = `${TILE_SIZE}px`;
            topBun.style.imageRendering = 'pixelated';
            topBun.style.zIndex = '1';
            bCard.appendChild(topBun);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(2, 80px)';
            grid.style.gap = '10px';
            grid.style.justifyContent = 'center';
            grid.style.marginTop = '10px';
            grid.style.marginBottom = '10px';
            grid.style.minHeight = '0px';
            grid.style.zIndex = '1';
            bCard.appendChild(grid);

            // Populate Grid with Assigned Items
            this.unlockState.assignments.forEach((assignIdx, rewardIdx) => {
                if (assignIdx === i) {
                    const card = this.rewardCardsMap.get(this.unlockState.rewards[rewardIdx]);
                    if (card) {
                        card.style.position = 'relative';
                        card.style.left = 'auto';
                        card.style.top = 'auto';
                        card.style.marginLeft = '0';
                        card.style.zIndex = 'auto';
                        card.style.display = 'flex';
                        card.style.opacity = '1';
                        grid.appendChild(card);
                    }
                }
            });

            const isHoveredWithGrabbed = this.unlockState.selectionMode === 'burger' &&
                this.unlockState.targetBurgerIndex === i &&
                this.unlockState.grabbedIndex !== null;

            if (isHoveredWithGrabbed) {
                const extraItem = this.unlockState.rewards[this.unlockState.grabbedIndex];
                const card = this.rewardCardsMap.get(extraItem);
                if (card) {
                    card.style.position = 'relative';
                    card.style.left = 'auto';
                    card.style.top = 'auto';
                    card.style.marginLeft = '0';
                    card.style.zIndex = 'auto';
                    card.style.display = 'flex';
                    card.style.opacity = '0.7'; // Semi-transparent preview
                    grid.appendChild(card);
                }
            }

            const bottomBun = document.createElement('img');
            bottomBun.src = this.getAssetUrl(bottomTexName);
            bottomBun.style.width = `${TILE_SIZE}px`;
            bottomBun.style.height = `${TILE_SIZE}px`;
            bottomBun.style.imageRendering = 'pixelated';
            bottomBun.style.zIndex = '1';
            bCard.appendChild(bottomBun);

            // Ingredient Count
            const countLabel = document.createElement('div');
            countLabel.textContent = `${count} ${count === 1 ? 'Topping' : 'Toppings'}`;
            countLabel.style.fontSize = '14px';
            countLabel.style.marginTop = '10px';
            countLabel.style.color = isConflict ? '#ff4444' : '#00ff00';
            countLabel.style.webkitTextStroke = '4px black';
            countLabel.style.zIndex = '20'; // Above the cards
            bCard.appendChild(countLabel);

            burgersContainer.appendChild(bCard);
        });

        // "New Burger" Slot
        const canAddNew = this.unlockState.tempBurgers.length < 8;
        if (canAddNew) {
            const nextIdx = this.unlockState.tempBurgers.length;
            const isSelected = this.unlockState.selectionMode === 'burger' && this.unlockState.targetBurgerIndex === nextIdx;

            const addCard = document.createElement('div');
            addCard.style.minWidth = '220px';
            addCard.style.height = '240px';
            addCard.style.backgroundSize = '100% 100%';
            addCard.style.backgroundRepeat = 'no-repeat';
            addCard.style.opacity = '0.6';
            addCard.style.borderRadius = '8px';
            addCard.style.display = 'flex';
            addCard.style.alignItems = 'center';
            addCard.style.justifyContent = 'center';
            addCard.style.fontSize = '40px';
            addCard.style.color = isSelected ? '#fff' : 'rgba(255,255,255,0.3)';
            addCard.style.pointerEvents = 'auto';
            addCard.style.border = isSelected ? '4px solid #fff' : '4px dashed rgba(255,255,255,0.3)';
            addCard.style.imageRendering = 'pixelated';
            addCard.style.transition = 'transform 0.1s, border 0.1s';
            addCard.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';

            addCard.style.backgroundImage = `url('/assets/ui/ticket_bg.png')`;
            addCard.style.backgroundSize = '100% 100%';
            addCard.style.cursor = 'pointer';
            addCard.onclick = (e) => {
                e.stopPropagation();
                this.createNewBurgerAt(nextIdx);
                this.render();
            };
            addCard.innerHTML = '+';
            burgersContainer.appendChild(addCard);
        }

        this.alertSystem.contentText.appendChild(burgersContainer);

        // Footer / Confirm
        const footer = document.createElement('div');
        footer.style.marginTop = '30px';
        footer.style.textAlign = 'center';

        const someAssigned = this.unlockState.assignments.some(a => a !== null);
        const hasNoConflicts = duplicateCountSet.size === 0;
        const canFinish = someAssigned && hasNoConflicts;

        if (this.unlockState.error) {
            const err = document.createElement('div');
            err.textContent = this.unlockState.error;
            err.style.color = '#ff4444';
            err.style.marginBottom = '10px';
            err.style.fontWeight = 'bold';
            err.style.webkitTextStroke = '4px black';
            footer.appendChild(err);
        }

        const btn = document.createElement('div');
        btn.className = 'alert-button';
        btn.style.margin = '0 auto';
        btn.style.width = '200px';
        btn.style.height = '60px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontFamily = "'Inter', sans-serif";
        btn.style.fontWeight = '900';
        btn.style.color = '#fff';
        btn.style.webkitTextStroke = '7px black';
        btn.style.paintOrder = 'stroke fill';
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = canFinish ? 'pointer' : 'not-allowed';
        btn.onclick = (e) => {
            e.stopPropagation();
            if (canFinish) {
                this.finish();
            } else {
                if (!someAssigned) this.unlockState.error = "Assign at least one topping!";
                else if (!hasNoConflicts) this.unlockState.error = "Topping counts must be unique!";
                this.render();
            }
        };
        btn.style.opacity = canFinish ? '1' : '0.5';
        btn.style.backgroundColor = canFinish ? '#4a4' : '#444';
        btn.style.borderRadius = '10px';
        btn.innerHTML = canFinish ? 'DONE' : 'ASSIGN AT LEAST ONE';

        btn.style.backgroundImage = `url(${this.getAssetUrl('ui/button_background.png')})`;
        btn.style.backgroundSize = '100% 100%';
        btn.style.transform = (this.unlockState.selectionMode === 'finish') ? 'scale(1.1)' : 'scale(1)';
        btn.style.border = (this.unlockState.selectionMode === 'finish') ? '4px solid white' : 'none';
        btn.style.backgroundColor = (this.unlockState.selectionMode === 'finish') ? 'transparent' : (canFinish ? '#4a4' : '#444');

        footer.appendChild(btn);
        this.alertSystem.contentText.appendChild(footer);
    }



    getIngredientCount(burger, burgerIdx) {
        let count = 0;
        // Count toppings already in the burger, excluding beef patty
        if (burger.state.toppings) {
            count += burger.state.toppings.filter(t => {
                const tId = t.definitionId || t;
                return tId !== 'beef_patty';
            }).length;
        }

        // Count newly assigned toppings
        this.unlockState.assignments.forEach(a => {
            if (a === burgerIdx) count++;
        });

        return count;
    }

    createNewBurgerAt(idx) {
        this.unlockState.tempBurgers.push({
            type: 'Composite',
            definitionId: 'burger',
            name: `Burger ${this.unlockState.tempBurgers.length + 1}`,
            state: {
                bun: new ItemInstance('plain_bun'),
                toppings: [(() => {
                    const patty = new ItemInstance('beef_patty');
                    patty.state.cook_level = 'cooked';
                    return patty;
                })()]
            }
        });

        const pieceIdx = this.unlockState.grabbedIndex !== null ? this.unlockState.grabbedIndex : this.unlockState.selectedIndex;
        this.unlockState.assignments[pieceIdx] = idx;
        this.unlockState.selectionMode = 'piece';
        this.unlockState.grabbedIndex = null;
        this.unlockState.selectedIndex = (pieceIdx + 1) % this.unlockState.rewards.length;
        this.unlockState.targetBurgerIndex = idx;
    }

    swapRewards(idx1, idx2) {
        const tempReward = this.unlockState.rewards[idx1];
        this.unlockState.rewards[idx1] = this.unlockState.rewards[idx2];
        this.unlockState.rewards[idx2] = tempReward;

        const tempAssign = this.unlockState.assignments[idx1];
        this.unlockState.assignments[idx1] = this.unlockState.assignments[idx2];
        this.unlockState.assignments[idx2] = tempAssign;


    }

    getToppingId(reward) {
        if (!reward) return null;
        if (reward.category === 'topping' || reward.isTopping) return reward.id;

        if (reward.produces) {
            const prod = DEFINITIONS[reward.produces];
            if (prod) {
                if (prod.category === 'topping' || prod.isTopping) return prod.id;
                const mappings = {
                    'tomato': 'tomato_slice',
                    'lettuce_head': 'lettuce_leaf',
                    'onion': 'onion_slice',
                    'cheddar_block': 'cheddar_cheese',
                    'swiss_block': 'swiss_cheese',
                    'pickle': 'pickle_slice'
                };
                if (mappings[prod.id]) return mappings[prod.id];
                return prod.id;
            }
        }

        let id = reward.id;
        if (id.endsWith('_box')) id = id.replace('_box', '');
        if (id.endsWith('_bag')) id = id.replace('_bag', '');
        return id;
    }

    handleInput(code) {
        if (!this.unlockState) return false;

        const action = this.game.settings.getAction(code);
        const isInteract = action === ACTIONS.INTERACT || code === 'Enter' || code === 'Space';
        const isPickUp = action === ACTIONS.PICK_UP || code === 'Backspace';
        const isUp = action === ACTIONS.MOVE_UP || code === 'ArrowUp';
        const isDown = action === ACTIONS.MOVE_DOWN || code === 'ArrowDown';
        const isLeft = action === ACTIONS.MOVE_LEFT || code === 'ArrowLeft';
        const isRight = action === ACTIONS.MOVE_RIGHT || code === 'ArrowRight';

        if (this.unlockState.selectionMode === 'piece') {
            const oldIdx = this.unlockState.selectedIndex;

            const getNextUnassigned = (start, step) => {
                let idx = (start + step + this.unlockState.rewards.length) % this.unlockState.rewards.length;
                while (this.unlockState.assignments[idx] !== null && idx !== start) {
                    idx = (idx + step + this.unlockState.rewards.length) % this.unlockState.rewards.length;
                }
                return idx;
            };

            if (isRight) {
                this.unlockState.selectedIndex = getNextUnassigned(oldIdx, 1);
                if (this.unlockState.grabbedIndex !== null) {
                    this.swapRewards(oldIdx, this.unlockState.selectedIndex);
                    this.unlockState.grabbedIndex = this.unlockState.selectedIndex;
                }
            } else if (isLeft) {
                this.unlockState.selectedIndex = getNextUnassigned(oldIdx, -1);
                if (this.unlockState.grabbedIndex !== null) {
                    this.swapRewards(oldIdx, this.unlockState.selectedIndex);
                    this.unlockState.grabbedIndex = this.unlockState.selectedIndex;
                }
            } else if (isDown) {
                this.unlockState.selectionMode = 'burger';
            } else if (isInteract || isPickUp) {
                // Toggle grab
                if (this.unlockState.grabbedIndex === this.unlockState.selectedIndex) {
                    this.unlockState.grabbedIndex = null;
                } else {
                    this.unlockState.grabbedIndex = this.unlockState.selectedIndex;
                }
            }
        } else if (this.unlockState.selectionMode === 'burger') {
            const maxBurgerIdx = this.unlockState.tempBurgers.length;
            if (isRight) {
                this.unlockState.targetBurgerIndex = (this.unlockState.targetBurgerIndex + 1) % (maxBurgerIdx + 1);
            } else if (isLeft) {
                this.unlockState.targetBurgerIndex = (this.unlockState.targetBurgerIndex - 1 + (maxBurgerIdx + 1)) % (maxBurgerIdx + 1);
            } else if (isUp) {
                this.unlockState.selectionMode = 'piece';
            } else if (isDown) {
                this.unlockState.selectionMode = 'finish';
            } else if (isInteract) {
                const targetIdx = this.unlockState.targetBurgerIndex;

                if (targetIdx === this.unlockState.tempBurgers.length) {
                    this.createNewBurgerAt(targetIdx);
                } else if (this.unlockState.grabbedIndex !== null) {
                    this.unlockState.assignments[this.unlockState.grabbedIndex] = targetIdx;
                    this.unlockState.grabbedIndex = null;
                    this.unlockState.selectionMode = 'piece';
                    // Optional: increment selected index to the next unassigned one?
                }
            } else if (isPickUp) {
                if (this.unlockState.grabbedIndex !== null) {
                    this.unlockState.grabbedIndex = null;
                } else {
                    // Unassign the last item from THIS burger
                    const burgerIdx = this.unlockState.targetBurgerIndex;
                    const lastRewardIdx = this.unlockState.assignments.lastIndexOf(burgerIdx);
                    if (lastRewardIdx !== -1) {
                        this.unlockState.assignments[lastRewardIdx] = null;
                        this.unlockState.selectedIndex = lastRewardIdx; // Switch selection to this item
                        this.unlockState.selectionMode = 'piece'; // Go back to pool mode
                    }
                }
            }
        } else if (this.unlockState.selectionMode === 'finish') {
            if (isUp) {
                this.unlockState.selectionMode = 'burger';
            } else if (isInteract) {
                this.finish();
            }
        }

        this.render();
        return true;
    }

    finish() {
        const someAssigned = this.unlockState.assignments.some(a => a !== null);
        if (!someAssigned) {
            this.unlockState.error = "At least one topping must be assigned!";
            this.render();
            return;
        }

        const counts = this.unlockState.tempBurgers.map((b, idx) => this.getIngredientCount(b, idx));
        const uniqueCounts = new Set(counts);
        if (uniqueCounts.size !== counts.length) {
            this.unlockState.error = "Burgers must have unique topping counts!";
            this.render();
            return;
        }

        // APPLY CHANGES
        this.unlockState.rewards.forEach((r, i) => {
            if (this.unlockState.assignments[i] !== null) {
                this.game.automatedRewardSystem.grantReward(r.id, true);
            }
        });

        this.unlockState.assignments.forEach((burgerIdx, rewardIdx) => {
            if (burgerIdx === null) return;
            const reward = this.unlockState.rewards[rewardIdx];
            const burger = this.unlockState.tempBurgers[burgerIdx];
            const toppingId = this.getToppingId(reward);
            burger.state.toppings.push(new ItemInstance(toppingId));
        });

        this.game.menuSystem.menuSlots = Array(64).fill(null);
        this.unlockState.tempBurgers.forEach((b, i) => {
            if (i < 64) this.game.menuSystem.menuSlots[i] = b;
        });

        this.game.menuSystem.updateAvailableItems();
        this.alertSystem.close();
    }
}
