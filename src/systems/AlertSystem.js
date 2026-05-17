
import { ALERTS } from '../data/alerts.js';
import { ACTIONS } from './Settings.js';
import { DEFINITIONS } from '../data/definitions.js';
import { ItemInstance } from '../entities/Item.js';
import { drawBurgerPixels } from '../renderers/ObjectRenderer.js';
import { assetUrl } from '../utils/assets.js';

function resolveUiAsset(path) {
    if (!path) return null;
    if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
        return path;
    }
    if (path.startsWith('/')) return assetUrl(path.slice(1));
    if (path.startsWith('assets/')) return assetUrl(path);
    return assetUrl(`assets/ui/${path}`);
}

export class AlertSystem {
    constructor(game) {
        this.game = game;
        this.activeAlert = null; // { id, frameIndex, currentStepIndex }
        this.isVisible = false;
        this.animationTimer = 0;
        this.currentFrame = 0; // 0, 1, 2
        this.frameTime = 150; // ms per frame for line boil

        this.container = null;
        this.contentDiv = null;
        this.slices = {}; // Store references to 9 slice divs

        // Frame Storage
        this.frames = [];
        this.framesLoaded = false;
        this.buttonBoilFrames = [];
        this.buttonBoilLoaded = false;

        this.initDOM();
        this.initFrames();
        this.initButtonFrames();

        this.buttons = [];
        this.selectedButtonIndex = 0;

        // Input lock — prevents accidental dismissal right after an alert opens
        this.inputLockTimer = 0; // ms remaining

        // Mini-Game State
        this.activeMiniGame = null;
    }

    initButtonFrames() {
        const img = new Image();
        img.src = assetUrl('assets/ui/button_background-boil.png');
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const frameWidth = img.width / 3;
            const frameHeight = img.height;
            canvas.width = frameWidth;
            canvas.height = frameHeight;

            for (let i = 0; i < 3; i++) {
                ctx.clearRect(0, 0, frameWidth, frameHeight);
                ctx.drawImage(img, i * frameWidth, 0, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
                this.buttonBoilFrames.push(canvas.toDataURL());
            }
            this.buttonBoilLoaded = true;
        };
    }

    initFrames() {
        const img = new Image();
        img.src = assetUrl('assets/ui/alert_window_sheet.png');
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Smarter approach: Detect dimensions from the sheet
            // We assume it's a vertical strip of 3 frames.
            const frameWidth = img.width;
            const frameHeight = img.height / 3;
            canvas.width = frameWidth;
            canvas.height = frameHeight;

            // Extract 3 frames
            for (let i = 0; i < 3; i++) {
                ctx.clearRect(0, 0, frameWidth, frameHeight);
                // Source Y is i * frameHeight
                ctx.drawImage(img, 0, i * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
                this.frames.push(canvas.toDataURL());
            }
            this.framesLoaded = true;
        };
    }

    initDOM() {


        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.classList.add('alert-backdrop');
        this.backdrop.style.position = 'absolute'; // sticky to the UI layer
        this.backdrop.style.top = '0';
        this.backdrop.style.left = '0';
        this.backdrop.style.width = '100%';
        this.backdrop.style.height = '100%';
        this.backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.backdrop.style.display = 'none';
        this.backdrop.style.zIndex = '900'; // Below alert container

        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'alert-system-container';
        this.container.classList.add('alert-container');
        this.container.style.display = 'none';
        this.container.style.zIndex = '1000'; // Ensure above backdrop

        // Create 9-slice background structure
        // Create background container (handled via CSS border-image)
        const nineSliceContainer = document.createElement('div');
        nineSliceContainer.classList.add('alert-bg');
        this.container.appendChild(nineSliceContainer);



        // Content Area
        this.contentText = document.createElement('div');
        this.contentText.classList.add('alert-content');
        this.contentText.style.fontFamily = "'Inter', sans-serif";
        this.contentText.style.fontWeight = '900';
        this.contentText.style.color = '#fff';
        this.contentText.style.color = '#fff';
        this.contentText.style.textShadow = `
            3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000,
            3px 0px 0 #000, -3px 0px 0 #000, 0px 3px 0 #000, 0px -3px 0 #000,
            4px 4px 0px rgba(0,0,0,0.5)
        `; // Clear 3px stroke via shadowed layering and extra depth
        this.container.appendChild(this.contentText);

        // Burger Preview Area
        this.burgerPreviewContainer = document.createElement('div');
        this.burgerPreviewContainer.classList.add('alert-burger-preview');
        this.burgerPreviewContainer.style.display = 'none';
        this.burgerPreviewContainer.style.justifyContent = 'center';
        this.burgerPreviewContainer.style.alignItems = 'center';
        this.burgerPreviewContainer.style.width = '100%';
        this.burgerPreviewContainer.style.height = '420px'; 
        this.burgerPreviewContainer.style.paddingTop = '100px'; 
        this.burgerPreviewContainer.style.position = 'relative';
        this.burgerPreviewContainer.style.zIndex = '15';
        this.container.appendChild(this.burgerPreviewContainer);

        this.burgerCanvas = document.createElement('canvas');
        this.burgerCanvas.width = 400; // Enlarged to handle 2x scale and multiple columns
        this.burgerCanvas.height = 400;
        this.burgerCanvas.style.imageRendering = 'pixelated';
        this.burgerCanvas.style.position = 'relative'; // Override global absolute
        this.burgerCanvas.style.top = 'auto';
        this.burgerCanvas.style.left = 'auto';
        this.burgerCanvas.style.boxShadow = 'none'; // Override global shadow
        this.burgerCanvas.style.backgroundColor = 'transparent';
        
        this.burgerPreviewContainer.appendChild(this.burgerCanvas);
        this.burgerCtx = this.burgerCanvas.getContext('2d');
        this.burgerCtx.imageSmoothingEnabled = false;

        this.burgerCanvas.onclick = (e) => {
            if (!this.allocationMode) return;
            const rect = this.burgerCanvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (this.burgerCanvas.width / rect.width);
            
            // Check which burger was clicked
            const { displayBurgerSlots, cardWidth, gutter, startX } = this.getLevelUpPreviewLayout();

            displayBurgerSlots.forEach((slot, i) => {
                if (!slot) return;
                const cardX = startX + i * (cardWidth + gutter);
                if (x >= cardX && x <= cardX + cardWidth) {
                    if (this.game.unlockTopping(this.allocationMode.toppingId, i)) {
                        this.finalizeToppingPick(this.allocationMode.buttonAction);
                    }
                }
            });
        };

        // Portrait Image
        this.portrait = document.createElement('img');
        this.portrait.classList.add('alert-portrait');
        this.portrait.style.position = 'absolute';
        this.portrait.style.zIndex = '20';
        this.portrait.style.pointerEvents = 'none';
        this.portrait.style.imageRendering = 'pixelated';
        this.container.appendChild(this.portrait);

        // Next Arrow / Button
        this.nextBtn = document.createElement('div');
        this.nextBtn.classList.add('alert-next-btn');
        // this.nextBtn.innerText = '▼'; // Optional visual
        this.container.appendChild(this.nextBtn);

        // Buttons Container
        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.classList.add('alert-buttons');
        this.buttonsContainer.style.display = 'flex';
        this.buttonsContainer.style.justifyContent = 'space-around';
        this.buttonsContainer.style.width = '100%';
        this.buttonsContainer.style.paddingTop = '20px'; // Space from text
        this.container.appendChild(this.buttonsContainer);

        this.backdrop.onclick = () => {
            if (this.isVisible && this.inputLockTimer <= 0 && this.buttons.length === 0) {
                this.advance();
            }
        };

        // Append to UI Layer
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) {
            uiLayer.appendChild(this.backdrop);
            uiLayer.appendChild(this.container);
        }
    }

    trigger(alertId, onComplete = null, data = {}) {
        const config = ALERTS[alertId];
        if (!config) {
            console.error(`Alert definition not found: ${alertId}`);
            if (onComplete) onComplete();
            return;
        }

        // If onComplete is provided, store it. 
        if (onComplete) {
            this.onComplete = onComplete;
        } else if (!this.activeAlert) {
            // New alert sequence without callback
            this.onComplete = null;
        }

        this.activeAlert = {
            id: alertId,
            config: config,
            currentStepIndex: 0,
            data: data
        };

        this.isVisible = true;
        this.container.style.display = 'flex';
        if (this.backdrop) this.backdrop.style.display = 'block';

        // Lock input for 1.5 s so players can't accidentally dismiss immediately
        this.inputLockTimer = 500;

        if (config.type === 'unlock_minigame') {
            // DISABLED: Minigame replaced by automatic unlock
            this.activeMiniGame = null;
            this.showCurrentStep();
        } else {
            this.activeMiniGame = null;
            this.showCurrentStep();
        }
    }

    showCurrentStep() {
        if (!this.activeAlert) return;

        const step = this.activeAlert.config.frames[this.activeAlert.currentStepIndex];

        // Update Text
        let text = step.text;
        if (this.activeAlert.data) {
            Object.keys(this.activeAlert.data).forEach(key => {
                // Replace {key} with val
                text = text.replace(new RegExp(`{${key}}`, 'g'), this.activeAlert.data[key]);
            });
        }

        // Automatic Action Key Replacement
        if (this.game && this.game.settings) {
            Object.keys(ACTIONS).forEach(actionKey => {
                const placeholder = `{${actionKey}}`;
                if (text.includes(placeholder)) {
                    text = text.replace(new RegExp(placeholder, 'g'), this.game.settings.getDisplayKey(ACTIONS[actionKey]));
                }
            });
        }
        const recipeRows = this.activeAlert.data?.recipeRows || step.recipeRows;
        if (recipeRows && recipeRows.length > 0) {
            this.contentText.innerHTML = this.renderRecipeRows(recipeRows);
        } else {
            this.contentText.innerHTML = text;
        }

        // Level-up Alert Special Logic: Show Burger Preview
        const isLevelUp = this.activeAlert.id === 'level_up';
        if (isLevelUp) {
            this.contentText.style.display = 'none';
            this.burgerPreviewContainer.style.display = 'flex';
            
            // Ensure preview burger exists in data
            if (!this.activeAlert.data.previewBurger) {
                // FETCH FROM SOURCE OF TRUTH (MenuSystem)
                const currentBurgerSlot = this.game.menuSystem.menuSlots[0];
                const previewBurger = new ItemInstance(currentBurgerSlot?.definitionId || 'plain_burger');
                
                if (currentBurgerSlot && currentBurgerSlot.state) {
                    previewBurger.state.bun = currentBurgerSlot.state.bun;
                    previewBurger.state.toppings = [...(currentBurgerSlot.state.toppings || [])];
                } else {
                    // Fallback
                    previewBurger.state.toppings = [new ItemInstance('beef_patty')];
                    previewBurger.state.toppings[0].state.cook_level = 'cooked';
                }
                
                this.activeAlert.data.previewBurger = previewBurger;
            }
        } else {
            this.contentText.style.display = 'block';
            this.burgerPreviewContainer.style.display = 'none';
        }

        // Clean up old buttons
        this.buttonsContainer.innerHTML = '';
        this.buttons = [];
        this.selectedButtonIndex = 0;

        // Reset buttons container style
        this.buttonsContainer.style.position = '';
        this.buttonsContainer.style.top = '';
        this.buttonsContainer.style.left = '';
        this.buttonsContainer.style.width = '100%';
        this.buttonsContainer.style.height = 'auto';
        this.buttonsContainer.style.display = 'flex';
        this.buttonsContainer.style.justifyContent = 'space-around';
        this.buttonsContainer.style.alignItems = 'center';
        this.buttonsContainer.style.gap = '0';
        this.buttonsContainer.style.paddingTop = '20px';

        // Create Buttons if present
        const buttons = (this.activeAlert.data && this.activeAlert.data.buttons) || step.buttons;
        if (buttons && buttons.length > 0) {
            this.nextBtn.style.display = 'none';
            
            // Special layout for level_up alert
            const isLevelUp = this.activeAlert.id === 'level_up';
            const isLevelUpChoice = this.activeAlert.id === 'level_up_choice';
            const isStarterSelection = this.activeAlert.id === 'starter_selection';
            if (isLevelUp) {
                this.buttonsContainer.style.position = 'absolute';
                this.buttonsContainer.style.top = '0';
                this.buttonsContainer.style.left = '0';
                this.buttonsContainer.style.width = '100%';
                this.buttonsContainer.style.height = '100%';
                this.buttonsContainer.style.display = 'block'; // Use absolute positioning for children instead
                this.buttonsContainer.style.paddingTop = '0';
                this.buttonsContainer.style.pointerEvents = 'none';
            } else if (isLevelUpChoice) {
                this.buttonsContainer.style.justifyContent = 'center';
                this.buttonsContainer.style.gap = '36px';
                this.buttonsContainer.style.paddingTop = '36px';
            } else if (isStarterSelection) {
                this.buttonsContainer.style.position = 'absolute';
                this.buttonsContainer.style.top = '105px';
                this.buttonsContainer.style.left = '0';
                this.buttonsContainer.style.width = '100%';
                this.buttonsContainer.style.height = '360px';
                this.buttonsContainer.style.display = 'block';
                this.buttonsContainer.style.paddingTop = '0';
            }

            buttons.forEach((btnConfig, index) => {
                const btn = document.createElement('div');
                btn.className = 'alert-button';
                // Inline styles for button visual
                btn.style.position = (isLevelUp || isStarterSelection) ? 'absolute' : 'relative';
                if (isLevelUpChoice) btn.style.position = 'relative';
                const isSquareBtn = !!btnConfig.boxImage || (btnConfig.image && (btnConfig.image.includes('button-clean') || btnConfig.image.includes('button_background-boil')));
                const isWideChoiceBtn = isLevelUpChoice;
                const isStarterConfirm = btnConfig.action?.type === 'starter_confirm';
                btn.style.width = isWideChoiceBtn ? '224px' : (isStarterConfirm ? '180px' : (isSquareBtn ? '128px' : '192px'));
                btn.style.height = isWideChoiceBtn ? '132px' : (isStarterConfirm ? '92px' : (isSquareBtn ? '128px' : '96px'));
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.fontFamily = "'Inter', sans-serif";
                btn.style.fontWeight = '900';
                btn.style.fontSize = isWideChoiceBtn ? '24px' : (isSquareBtn ? '18px' : '24px');
                btn.style.color = '#fff';
                btn.style.textShadow = `
                    2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000,
                    2px 0px 0 #000, -2px 0px 0 #000, 0px 2px 0 #000, 0px -2px 0 #000,
                    3px 3px 0px rgba(0,0,0,0.5)
                `; // Using slightly thinner stroke (2px) for buttons so letters don't collide too much
                btn.style.cursor = 'pointer';
                btn.style.transition = 'transform 0.1s';
                btn.style.pointerEvents = 'auto'; // Re-enable pointer events
                if (isWideChoiceBtn) {
                    btn.style.padding = '12px 16px';
                    btn.style.boxSizing = 'border-box';
                }

                if (isLevelUp) {
                    if (btnConfig.action === 'dismiss') {
                        // OK Button: Bottom Right
                        btn.style.bottom = '40px';
                        btn.style.right = '40px';
                    } else {
                        // Topping Buttons: Top Middle
                        // There are 3 toppers usually. We can space them out.
                        const topperCount = buttons.filter(b => b.action !== 'dismiss').length;
                        const topperIndex = buttons.filter((b, i) => b.action !== 'dismiss' && i < index).length;
                        
                        btn.style.top = '80px';
                        const totalWidth = topperCount * 160; // Approximate width with spacing
                        const startX = (parseFloat(step.size.width) - totalWidth) / 2;
                        btn.style.left = `${startX + topperIndex * 160 + 16}px`;
                    }
                } else if (isStarterSelection) {
                    const burgerButtons = buttons.filter(b => b.action?.type === 'starter_select' && b.action.group === 'burger');
                    const sideButtons = buttons.filter(b => b.action?.type === 'starter_select' && b.action.group === 'side');
                    const isBurger = btnConfig.action?.group === 'burger';
                    const isSide = btnConfig.action?.group === 'side';
                    const rowButtons = isBurger ? burgerButtons : sideButtons;
                    const rowIndex = rowButtons.indexOf(btnConfig);
                    const gap = 30;
                    const rowWidth = rowButtons.length * 128 + Math.max(0, rowButtons.length - 1) * gap;
                    const left = (parseFloat(step.size.width) - rowWidth) / 2 + rowIndex * (128 + gap);

                    if (isBurger || isSide) {
                        btn.style.left = `${left}px`;
                        btn.style.top = isBurger ? '0px' : '150px';
                    } else if (isStarterConfirm) {
                        btn.style.left = `${(parseFloat(step.size.width) - 180) / 2}px`;
                        btn.style.top = '302px';
                    }
                }

                const imgPath = btnConfig.image ? resolveUiAsset(btnConfig.image) : null;
                const isBoil = btnConfig.image && btnConfig.image.includes('button_background-boil');
                let initialImgSrc = isBoil ? assetUrl('assets/ui/button-clean.png') : imgPath;
                
                const starterPicked = this.isStarterSelectionButtonPicked(btnConfig);
                if (isBoil && this.buttonBoilLoaded && (index === this.selectedButtonIndex || starterPicked)) {
                    initialImgSrc = this.buttonBoilFrames[0];
                }

                const imgHTML = initialImgSrc ? `<div style="position: absolute; top:0; left:0; width:100%; height:100%; z-index:0;">
                         <img class="alert-btn-bg" src="${initialImgSrc}" style="width:100%; height:100%; object-fit:fill; image-rendering:pixelated;">
                    </div>` : '';

                let labelText = btnConfig.label || btnConfig.text || 'OK';
                let subLabel = btnConfig.subLabel || '';

                const showLabel = !btnConfig.boxImage || labelText === 'OK' || isStarterSelection;

                btn.innerHTML = `
                    ${imgHTML}
                    <div style="position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; padding:${isWideChoiceBtn ? '12px' : '0'}; box-sizing:border-box;">
                        ${btnConfig.boxImage ? `
                            <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                                <img src="${resolveUiAsset(btnConfig.boxImage)}" 
                                     style="width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated;">
                            </div>
                        ` : ''}
                        ${showLabel ? `
                            <span style="position:relative; z-index:2;">${labelText}</span>
                            ${subLabel ? `<span style="font-size: 14px; opacity: 0.9; margin-top: 4px; pointer-events: none;">${subLabel}</span>` : ''}
                        ` : ''}
                    </div>
                `;

                btn.onclick = () => {
                    if (this.inputLockTimer > 0) return;
                    this.executeAction(btnConfig.action);
                };

                this.buttonsContainer.appendChild(btn);
                this.buttons.push({ element: btn, config: btnConfig });

                // Level-up alert special: the OK/Lock Menu button is always enabled now
                if (this.activeAlert.id === 'level_up' && btnConfig.action === 'dismiss') {
                    btn.style.opacity = '1.0';
                    btn.style.filter = 'none';
                    btn.style.cursor = 'pointer';
                }

                // If this topping was already picked, hide it
                if (this.activeAlert.id === 'level_up' && btnConfig.action && btnConfig.action.type === 'unlock_topping') {
                    const alreadyPicked = this.activeAlert.data.unlockedToppings && this.activeAlert.data.unlockedToppings.has(btnConfig.action.toppingId);
                    const isAvailable = this.isUnlockActionAvailable(btnConfig.action);
                    if (alreadyPicked || !isAvailable) {
                        btn.style.display = 'none';
                        btn.style.pointerEvents = 'none';
                    }
                }
            });
            this.selectedButtonIndex = this.getNextVisibleButton(this.selectedButtonIndex, 1);
            this.updateButtonSelection();
        } else {
            this.nextBtn.style.display = 'block';
            this.nextBtn.onclick = () => {
                if (this.inputLockTimer > 0) return;
                this.advance();
            };
        }


        // Update Size and Position
        this.updateLayout(step);

        // Update Portrait
        if (step.portrait) {
            this.portrait.src = resolveUiAsset(step.portrait);
            this.portrait.style.display = 'block';

            const hPos = step.portraitSide || 'left';
            const vPos = step.portraitVAlign || 'bottom';

            this.portrait.style.top = vPos === 'top' ? '-40px' : '';
            this.portrait.style.bottom = vPos === 'bottom' ? '-20px' : '';
            this.portrait.style.left = hPos === 'left' ? '-40px' : '';
            this.portrait.style.right = hPos === 'right' ? '-40px' : '';
            this.portrait.style.width = '200px';
            this.portrait.style.height = 'auto';
            this.portrait.style.transform = hPos === 'right' ? 'scaleX(-1)' : ''; // Flip if on right
        } else {
            this.portrait.style.display = 'none';
        }
    }

    renderRecipeRows(rows) {
        const renderToken = (token) => {
            if (!token) return '';
            if (token.type === 'image') {
                return `<img class="alert-recipe-img" src="${resolveUiAsset(token.src)}" alt="">`;
            }
            if (token.type === 'symbol') {
                return `<span class="alert-recipe-symbol">${token.value || ''}</span>`;
            }
            return '';
        };

        return `<div class="alert-recipe">${rows.map(tokens => `
            <div class="alert-recipe-row">${tokens.map(renderToken).join('')}</div>
        `).join('')}</div>`;
    }

    updateButtonSelection() {
        this.buttons.forEach((b, i) => {
            const img = b.element.querySelector('img');
            const isLevelUpOKDisabled = false; // Always enabled now
            const starterData = this.activeAlert?.id === 'starter_selection' ? this.activeAlert.data : null;
            const isStarterConfirm = b.config.action?.type === 'starter_confirm';
            const isStarterPicked = this.isStarterSelectionButtonPicked(b.config);
            const isStarterConfirmDisabled = starterData && isStarterConfirm && (!starterData.selectedBurgerId || !starterData.selectedSideId);

            const isSelected = i === this.selectedButtonIndex;
            const isHidden = b.element.style.display === 'none';

            // Special handling for Level Up OK button visibility/usability
            if (isLevelUpOKDisabled || isStarterConfirmDisabled) {
                b.element.style.opacity = '0.5';
                b.element.style.filter = 'grayscale(1)';
                b.element.style.cursor = 'default';
                if (img) img.style.filter = 'grayscale(1)';
            } else {
                b.element.style.opacity = '1.0';
                b.element.style.filter = 'none';
                b.element.style.cursor = 'pointer';
                if (img) img.style.filter = 'none';
            }

            b.element.style.outline = 'none';
            b.element.style.outlineOffset = '0';

            if (isSelected && !isLevelUpOKDisabled && !isStarterConfirmDisabled && !isHidden) {
                b.element.style.transform = 'scale(1.1)';
                if (img) img.style.filter = 'brightness(1.2)';
            } else {
                b.element.style.transform = 'scale(1.0)';
            }
        });
    }

    getNextVisibleButton(currentIndex, direction) {
        const len = this.buttons.length;
        if (len === 0) return -1;
        
        let next = currentIndex;
        for (let i = 0; i < len; i++) {
            next = (next + direction + len) % len;
            if (this.buttons[next].element.style.display !== 'none') {
                return next;
            }
        }
        return currentIndex;
    }

    isUnlockActionAvailable(action) {
        if (!action || action.type !== 'unlock_topping') return true;
        return this.game.getUnlockAvailability(action.toppingId) > 0;
    }

    isStarterSelectionButtonPicked(btnConfig) {
        const data = this.activeAlert?.id === 'starter_selection' ? this.activeAlert.data : null;
        if (!data || btnConfig.action?.type !== 'starter_select') return false;
        return (
            (btnConfig.action.group === 'burger' && data.selectedBurgerId === btnConfig.action.id) ||
            (btnConfig.action.group === 'side' && data.selectedSideId === btnConfig.action.id)
        );
    }

    executeAction(action) {
        if (action?.type === 'starter_select') {
            if (action.group === 'burger') {
                this.activeAlert.data.selectedBurgerId = action.id;
            } else if (action.group === 'side') {
                this.activeAlert.data.selectedSideId = action.id;
            }
            this.updateButtonSelection();
        } else if (action?.type === 'starter_confirm') {
            const burgerId = this.activeAlert.data?.selectedBurgerId;
            const sideId = this.activeAlert.data?.selectedSideId;
            if (!burgerId || !sideId) return;
            this.activeAlert.data.onStarterConfirm?.({ burgerId, sideId });
            this.close();
        } else if (action === 'faster_tickets' || action === 'more_complexity') {
            if (this.activeAlert.data?.onChoice) {
                this.activeAlert.data.onChoice(action);
            }
            this.close();
        } else if (action === 'dismiss') {
            this.advance();
        } else if (action === 'reroll') {
            this.rerollToppings();
        } else if (this.activeAlert.id === 'level_up') {
            if (this.activeAlert.data.pickedCount === undefined) this.activeAlert.data.pickedCount = 0;
            
            // Check if already picked (robustness)
            if (this.activeAlert.data.unlockedToppings === undefined) this.activeAlert.data.unlockedToppings = new Set();
            if (this.activeAlert.data.unlockedToppings.has(action.toppingId)) return;

            // SPECIAL CASE: Chicken Patty immediately unlocks the burger
            if (action.toppingId === 'chicken_patty') {
                if (this.game.unlockTopping(action.toppingId)) {
                    this.finalizeToppingPick(action);
                } else {
                    this.showCurrentStep();
                }
                return;
            }

            // Check if we need allocation
            const activeSlots = this.game.menuSystem.menuSlots.filter(s => s !== null);
            if (activeSlots.length > 1 && !this.isToppingSide(action.toppingId)) {
                const validSlotIndexes = activeSlots
                    .map((slot, index) => this.game.menuSystem.burgerCanTakeTopping(slot, action.toppingId) ? index : -1)
                    .filter(index => index >= 0);
                if (validSlotIndexes.length === 0) {
                    this.showCurrentStep();
                    return;
                }

                // ENTER ALLOCATION MODE
                this.allocationMode = { toppingId: action.toppingId, buttonAction: action };
                this.selectedBurgerIndex = validSlotIndexes[0];
                this.showCurrentStep(); // Re-render to show allocation prompt
            } else {
                // Immediate unlock (for sides or if only one burger)
                if (this.game.unlockTopping(action.toppingId, 0)) {
                    this.finalizeToppingPick(action);
                } else {
                    this.showCurrentStep();
                }
            }
        }
    }

    handleBackAction() {
        const onBack = this.activeAlert?.data?.onBack;
        if (!onBack) return false;
        this.close();
        onBack();
        return true;
    }

    isToppingSide(id) {
        const def = DEFINITIONS[id];
        return id === 'sweet_potato_fries' || (def && def.orderConfig && def.orderConfig.type === 'side');
    }

    finalizeToppingPick(action) {
        this.activeAlert.data.pickedCount++;
        this.activeAlert.data.unlockedToppings.add(action.toppingId);

        // Visual feedback on the button
        const btnObj = this.buttons.find(b => b.config.action === action);
        if (btnObj) {
            btnObj.element.style.display = 'none';
            btnObj.element.style.pointerEvents = 'none';
            
            if (this.buttons.indexOf(btnObj) === this.selectedButtonIndex) {
                this.selectedButtonIndex = this.getNextVisibleButton(this.selectedButtonIndex, 1);
                this.updateButtonSelection();
            }
        }

        if (this.activeAlert.data.pickedCount >= 1) {
            this.updateButtonSelection();
        }

        this.allocationMode = null;
        this.showCurrentStep();
    }

    rerollToppings() {
        if (!this.activeAlert || !this.activeAlert.data.buttons) return;

        const data = this.activeAlert.data;
        const unlocked = data.unlockedToppings || new Set();

        // Find buttons in data that are unlock_topping and NOT yet picked
        const toppingButtons = data.buttons.filter(b =>
            b.action &&
            b.action.type === 'unlock_topping' &&
            !unlocked.has(b.action.toppingId)
        );

        if (toppingButtons.length === 0) return;

        const currentToppingIds = toppingButtons.map(b => b.action.toppingId);
        // We also want to exclude toppings that ARE already picked (unlocked set)
        const excludeIds = [...unlocked, ...currentToppingIds];

        const newToppings = this.game.getRerollToppings(toppingButtons.length, excludeIds);

        toppingButtons.forEach((b, i) => {
            const newId = newToppings[i];
            if (!newId) return; // Should not happen if pool is large enough

            const newConfig = this.game.getToppingButtonConfig(newId);
            // Replace button config properties (spread them in)
            Object.assign(b, newConfig);
        });

        // Re-render
        this.showCurrentStep();
    }

    updateLayout(step) {
        // Reset styles
        this.container.style.top = '';
        this.container.style.left = '';
        this.container.style.bottom = '';
        this.container.style.right = '';
        this.container.style.transform = '';
        this.container.style.width = step.size.width;
        this.container.style.height = step.size.height;

        if (step.position === 'center') {
            this.container.style.top = '50%';
            this.container.style.left = '50%';
            this.container.style.transform = 'translate(-50%, -50%)';
        } else if (typeof step.position === 'object') {
            if (step.position.top) this.container.style.top = step.position.top;
            if (step.position.left) this.container.style.left = step.position.left;
            if (step.position.bottom) this.container.style.bottom = step.position.bottom;
            if (step.position.right) this.container.style.right = step.position.right;

            // Handle centering helper
            if (step.position.left === '50%' && !step.position.top) {
                this.container.style.transform = 'translateX(-50%)';
            }
            if (step.position.top === '50%' && !step.position.left) {
                this.container.style.transform = 'translateY(-50%)';
            }
            if (step.position.top === '50%' && step.position.left === '50%') {
                this.container.style.transform = 'translate(-50%, -50%)';
            }
        }
    }

    advance() {
        if (!this.activeAlert) return;

        const config = this.activeAlert.config;
        const currentIndex = this.activeAlert.currentStepIndex;

        // Requirement check for level_up alert removed since Lock Menu is an option

        // Are there more steps?
        if (currentIndex < config.frames.length - 1) {
            this.activeAlert.currentStepIndex++;
            this.showCurrentStep();
        } else {
            // End of alert
            this.close();
            // Chain next?
            if (config.frames[currentIndex].next) {
                this.trigger(config.frames[currentIndex].next);
            }
        }
    }

    close() {
        const wasMiniGame = !!this.activeMiniGame;
        this.isVisible = false;
        this.container.style.display = 'none';
        if (this.backdrop) this.backdrop.style.display = 'none';

        const cb = this.onComplete;
        this.onComplete = null;
        this.activeAlert = null;
        this.activeMiniGame = null;

        if (wasMiniGame) {
            this.game.playNextSong();
        }

        if (cb) {
            cb();
        }
    }

    getLevelUpPreviewLayout() {
        const caps = this.game.menuCaps || { burgers: 2, sides: 2 };
        const activeSlots = this.game.menuSystem.getActiveBurgerSlots();
        const displayBurgerSlots = Array.from({ length: caps.burgers }, (_, i) => this.game.menuSystem.menuSlots[i] || null);
        const cardWidth = 160;
        const gutter = 20;
        const totalWidth = displayBurgerSlots.length * cardWidth + Math.max(0, displayBurgerSlots.length - 1) * gutter;

        const activeSides = this.game.menuSystem.sides || [];
        const sessionUnlocks = this.activeAlert?.data?.unlockedToppings || new Set();
        const sidesToDraw = [...activeSides.map(s => s.definitionId)];
        if (!sidesToDraw.includes('fries')) {
            sidesToDraw.unshift('fries');
        }
        sessionUnlocks.forEach(id => {
            if (this.isToppingSide(id) && !sidesToDraw.includes(id) && sidesToDraw.length < caps.sides) {
                sidesToDraw.push(id);
            }
        });

        const displaySideSlots = Array.from({ length: caps.sides }, (_, i) => sidesToDraw[i] || null);
        const sideColumnWidth = 118;
        const contentWidth = totalWidth + sideColumnWidth;
        const canvasWidth = Math.max(400, contentWidth + 60);
        const startX = (canvasWidth - contentWidth) / 2;
        const sideX = startX + totalWidth + 30;

        return {
            activeSlots,
            displayBurgerSlots,
            cardWidth,
            gutter,
            totalWidth,
            startX,
            sideX,
            displaySideSlots,
            canvasWidth
        };
    }

    update(dt) {
        if (!this.isVisible) return;

        // Tick down the input lock
        if (this.inputLockTimer > 0) {
            this.inputLockTimer = Math.max(0, this.inputLockTimer - dt);
        }

        if (this.activeMiniGame && this.activeMiniGame.update) {
            this.activeMiniGame.update(dt);
        }

        // Animate Line Boil
        this.animationTimer += dt;
        if (this.animationTimer > this.frameTime) {
            this.animationTimer = 0;
            this.currentFrame = (this.currentFrame + 1) % 3;

            // Update Border Image Source if frames are ready
            if (this.framesLoaded && this.frames[this.currentFrame]) {
                const bg = this.container.querySelector('.alert-bg');
                if (bg) {
                    bg.style.borderImageSource = `url(${this.frames[this.currentFrame]})`;
                }
            }

        }

        // Update Boiling Buttons (Every Frame for hover responsiveness)
        if (this.buttonBoilLoaded) {
            this.buttons.forEach((b, i) => {
                const isSelected = i === this.selectedButtonIndex;
                const isLevelUpOKDisabled = false;
                const starterData = this.activeAlert?.id === 'starter_selection' ? this.activeAlert.data : null;
                const isStarterConfirmDisabled = starterData &&
                    b.config.action?.type === 'starter_confirm' &&
                    (!starterData.selectedBurgerId || !starterData.selectedSideId);
                const canBoil = (isSelected || this.isStarterSelectionButtonPicked(b.config)) && !isLevelUpOKDisabled && !isStarterConfirmDisabled;
                
                const isBoilAsset = b.config.image && b.config.image.includes('button_background-boil');
                const img = b.element.querySelector('.alert-btn-bg');
                
                if (img && isBoilAsset) {
                    const targetSrc = canBoil ? this.buttonBoilFrames[this.currentFrame] : assetUrl('assets/ui/button-clean.png');
                    if (img.src !== targetSrc) {
                        img.src = targetSrc;
                    }
                }
            });
        }

        // Continuous Render for Level-Up Burger (to handle lazy-loaded assets)
        if (this.activeAlert?.id === 'level_up') {
            this.renderLevelUpBurger();
        }
    }

    renderLevelUpBurger() {
        if (!this.activeAlert) return;

        const layout = this.getLevelUpPreviewLayout();
        if (this.burgerCanvas.width !== layout.canvasWidth) {
            this.burgerCanvas.width = layout.canvasWidth;
            this.burgerCtx = this.burgerCanvas.getContext('2d');
            this.burgerCtx.imageSmoothingEnabled = false;
        }

        const ctx = this.burgerCtx;
        const renderer = this.game.renderer;
        const scale = 1.5;

        ctx.clearRect(0, 0, this.burgerCanvas.width, this.burgerCanvas.height);
        ctx.imageSmoothingEnabled = false;

        const { displayBurgerSlots, cardWidth, gutter, totalWidth, startX, sideX, displaySideSlots } = layout;
        const cardHeight = 220;
        const startY = 60;

        displayBurgerSlots.forEach((slot, i) => {
            const cardX = startX + i * (cardWidth + gutter);
            
            // DRAW DINER MENU CARD (Subtle)
            ctx.fillStyle = '#fff9f0';
            ctx.strokeStyle = '#d4c4a8';
            ctx.lineWidth = 2;
            
            // Subtle Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            
            // Rounded rect (manual)
            const r = 8;
            ctx.beginPath();
            ctx.moveTo(cardX + r, startY);
            ctx.lineTo(cardX + cardWidth - r, startY);
            ctx.quadraticCurveTo(cardX + cardWidth, startY, cardX + cardWidth, startY + r);
            ctx.lineTo(cardX + cardWidth, startY + cardHeight - r);
            ctx.quadraticCurveTo(cardX + cardWidth, startY + cardHeight, cardX + cardWidth - r, startY + cardHeight);
            ctx.lineTo(cardX + r, startY + cardHeight);
            ctx.quadraticCurveTo(cardX, startY + cardHeight, cardX, startY + cardHeight - r);
            ctx.lineTo(cardX, startY + r);
            ctx.quadraticCurveTo(cardX, startY, cardX + r, startY);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Highlight if in allocation mode
            const isSelected = this.allocationMode && i === this.selectedBurgerIndex;
            if (isSelected) {
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 6;
                ctx.stroke();
            } else if (this.allocationMode) {
                ctx.strokeStyle = '#d4c4a8';
                ctx.lineWidth = 2;
                ctx.stroke();
            }


            ctx.shadowColor = 'transparent'; // Reset shadow

            // LABEL
            ctx.fillStyle = '#4a3c28';
            ctx.font = '900 18px "Inter", sans-serif';
            ctx.textAlign = 'center';
            if (slot) {
                ctx.fillText(slot.name.toUpperCase(), cardX + cardWidth / 2, startY + 25);
                ctx.fillText('BURGER', cardX + cardWidth / 2, startY + 45);

                // DRAW BURGER PIXELS
                const burger = new ItemInstance('plain_burger');
                if (slot.state) {
                    burger.state.bun = slot.state.bun;
                    burger.state.toppings = [...(slot.state.toppings || [])];
                    
                    // Add session preview topping if being allocated
                    if (this.allocationMode && this.selectedBurgerIndex === i) {
                        burger.state.toppings.push(this.allocationMode.toppingId);
                    }
                }
                
                const bX = cardX + (cardWidth - 64 * scale) / 2;
                const bY = startY + 60;
                drawBurgerPixels(renderer, burger, bX, bY, scale, ctx);
            } else {
                ctx.fillText('EMPTY', cardX + cardWidth / 2, startY + 34);
                ctx.fillText('BURGER SLOT', cardX + cardWidth / 2, startY + 56);
                ctx.font = '900 46px "Inter", sans-serif';
                ctx.fillStyle = '#c9b89c';
                ctx.fillText('+', cardX + cardWidth / 2, startY + 148);
                ctx.font = '900 18px "Inter", sans-serif';
                ctx.fillStyle = '#7a6a50';
                ctx.fillText('COMPLEXITY PICK', cardX + cardWidth / 2, startY + 188);
            }

            // Allocation Hover Check (simple)
            if (this.allocationMode) {
                if (isSelected) {
                    ctx.fillStyle = 'rgba(255, 204, 0, 0.1)';
                    ctx.fillRect(cardX, startY, cardWidth, cardHeight);
                    ctx.fillStyle = '#ffcc00';
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                    ctx.fillRect(cardX, startY, cardWidth, cardHeight);
                    ctx.fillStyle = '#999';
                }
                ctx.font = '900 14px "Inter", sans-serif';
                ctx.fillText(isSelected ? '-> PRESS ENTER TO ASSIGN <-' : 'SELECT WITH ARROWS', cardX + cardWidth / 2, startY + cardHeight - 15);
            }
        });

        // DRAW SIDE SLOTS
        displaySideSlots.forEach((sideId, index) => {
            const slotSize = 88;
            const slotY = startY + index * (slotSize + 18);

            ctx.fillStyle = '#fff9f0';
            ctx.strokeStyle = '#d4c4a8';
            ctx.lineWidth = 2;
            ctx.fillRect(sideX, slotY, slotSize, slotSize);
            ctx.strokeRect(sideX, slotY, slotSize, slotSize);

            if (sideId) {
                const tex = sideId === 'fries' ? 'fries-done.png' : (sideId === 'sweet_potato_fries' ? 'sweet_potato_fries-done.png' : null);
                const img = tex ? renderer.assetLoader.get(tex) : null;
                if (img) {
                    ctx.drawImage(img, sideX + 12, slotY + 12, 64, 64);
                }
            } else {
                ctx.fillStyle = '#c9b89c';
                ctx.font = '900 38px "Inter", sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('+', sideX + slotSize / 2, slotY + 56);
            }
        });
    }

    // Input handling
    handleInput(code) {
        if (!this.isVisible) return false;

        // Still within the grace period — swallow the input but don't act on it
        if (this.inputLockTimer > 0) return true;

        if (this.activeMiniGame) {
            return this.activeMiniGame.handleInput(code);
        }

        const action = this.game.settings.getAction(code);
        const isInteract = action === ACTIONS.INTERACT || code === 'Enter' || code === 'Space';
        const isLeft = action === ACTIONS.MOVE_LEFT || code === 'ArrowLeft';
        const isRight = action === ACTIONS.MOVE_RIGHT || code === 'ArrowRight';
        const isUp = action === ACTIONS.MOVE_UP || code === 'ArrowUp';
        const isDown = action === ACTIONS.MOVE_DOWN || code === 'ArrowDown';
        const isBack = code === 'Escape';

        if (this.allocationMode) {
            if (isBack) {
                this.allocationMode = null;
                this.showCurrentStep();
                return true;
            }

            const activeSlots = this.game.menuSystem.menuSlots.filter(s => s !== null);
            const validSlotIndexes = activeSlots
                .map((slot, index) => this.game.menuSystem.burgerCanTakeTopping(slot, this.allocationMode.toppingId) ? index : -1)
                .filter(index => index >= 0);

            if (validSlotIndexes.length === 0) {
                this.allocationMode = null;
                this.showCurrentStep();
                return true;
            }

            if (isRight) {
                const currentPos = Math.max(0, validSlotIndexes.indexOf(this.selectedBurgerIndex));
                this.selectedBurgerIndex = validSlotIndexes[(currentPos + 1) % validSlotIndexes.length];
                this.showCurrentStep();
                return true;
            } else if (isLeft) {
                const currentPos = Math.max(0, validSlotIndexes.indexOf(this.selectedBurgerIndex));
                this.selectedBurgerIndex = validSlotIndexes[(currentPos - 1 + validSlotIndexes.length) % validSlotIndexes.length];
                this.showCurrentStep();
                return true;
            } else if (isInteract) {
                if (this.game.unlockTopping(this.allocationMode.toppingId, this.selectedBurgerIndex)) {
                    this.finalizeToppingPick(this.allocationMode.buttonAction);
                }
                return true;
            }
            return true; // Swallow while in allocation
        }

        if (isBack && this.activeAlert?.id === 'level_up') {
            return this.handleBackAction();
        }

        if (this.activeAlert?.id === 'starter_selection' && this.buttons.length > 0) {
            const current = this.buttons[this.selectedButtonIndex];
            const currentGroup = current?.config?.action?.group || 'confirm';
            const groups = ['burger', 'side', 'confirm'];
            const currentRow = Math.max(0, groups.indexOf(currentGroup));

            if (isUp || isDown) {
                const nextRow = Math.max(0, Math.min(groups.length - 1, currentRow + (isDown ? 1 : -1)));
                const nextIndex = this.buttons.findIndex(b => (b.config.action?.group || 'confirm') === groups[nextRow]);
                if (nextIndex >= 0) {
                    this.selectedButtonIndex = nextIndex;
                    this.updateButtonSelection();
                }
                return true;
            }
        }

        // Button Navigation
        if (this.buttons.length > 0) {
            if (isRight) {
                this.selectedButtonIndex = this.getNextVisibleButton(this.selectedButtonIndex, 1);
                this.updateButtonSelection();
                return true;
            } else if (isLeft) {
                this.selectedButtonIndex = this.getNextVisibleButton(this.selectedButtonIndex, -1);
                this.updateButtonSelection();
                return true;
            } else if (isInteract) {
                const btn = this.buttons[this.selectedButtonIndex];
                if (btn && btn.element.style.display !== 'none') {
                    this.executeAction(btn.config.action);
                }
                return true;
            }
        }

        if (isInteract) {
            this.advance();
            return true; // Consumed
        }
        return false;
    }
}
