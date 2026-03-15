
import { ALERTS } from '../data/alerts.js';
import { ACTIONS } from './Settings.js';
import { DEFINITIONS } from '../data/definitions.js';

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

        this.initDOM();
        this.initFrames();

        this.buttons = [];
        this.selectedButtonIndex = 0;

        // Input lock — prevents accidental dismissal right after an alert opens
        this.inputLockTimer = 0; // ms remaining

        // Mini-Game State
        this.activeMiniGame = null;
    }

    initFrames() {
        const img = new Image();
        img.src = '/assets/ui/alert_window_sheet.png';
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
        // Add SVG Filter for thick, spike-free outlines if it doesn't exist
        if (!document.getElementById('alert-stroke-svg')) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'alert-stroke-svg';
            svg.setAttribute('width', '0');
            svg.setAttribute('height', '0');
            svg.style.position = 'absolute';
            svg.style.pointerEvents = 'none';
            svg.innerHTML = `
                <defs>
                    <filter id="cleanOutline" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
                        <!-- Expand the shape -->
                        <feMorphology operator="dilate" radius="9" in="SourceAlpha" result="dilated" />
                        <!-- Soften edges to round corners (prevents spikes) -->
                        <feGaussianBlur stdDeviation="2.2" in="dilated" result="blurred" />
                        <!-- Threshold the alpha to create a sharp, rounded stroke -->
                        <feComponentTransfer in="blurred" result="rounded">
                            <feFuncA type="linear" slope="20" intercept="-10" />
                        </feComponentTransfer>
                        <!-- Color the stroke black -->
                        <feFlood flood-color="black" result="black" />
                        <feComposite in="black" in2="rounded" operator="in" result="outline" />
                        <!-- Merge outline with original text -->
                        <feMerge>
                            <feMergeNode in="outline" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            `;
            document.body.appendChild(svg);
        }

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
        this.contentText.style.filter = 'url(#cleanOutline)';
        this.contentText.style.textShadow = 'none'; // Replaced by filter outline
        this.container.appendChild(this.contentText);

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
        this.contentText.innerHTML = text;

        // Clean up old buttons
        this.buttonsContainer.innerHTML = '';
        this.buttons = [];
        this.selectedButtonIndex = 0;

        // Create Buttons if present
        const buttons = (this.activeAlert.data && this.activeAlert.data.buttons) || step.buttons;
        if (buttons && buttons.length > 0) {
            this.nextBtn.style.display = 'none';
            buttons.forEach((btnConfig, index) => {
                const btn = document.createElement('div');
                btn.className = 'alert-button';
                // Inline styles for button visual
                btn.style.position = 'relative';
                btn.style.width = '192px';
                btn.style.height = '96px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.fontFamily = "'Inter', sans-serif";
                btn.style.fontWeight = '900';
                btn.style.color = '#fff';
                btn.style.filter = 'url(#cleanOutline)';
                btn.style.cursor = 'pointer';
                btn.style.transition = 'transform 0.1s';

                const imgPath = btnConfig.image ? (btnConfig.image.startsWith('/') ? btnConfig.image : `assets/ui/${btnConfig.image}`) : null;
                const imgHTML = imgPath ? `<div style="position: absolute; top:0; left:0; width:100%; height:100%; z-index:0;">
                         <img src="${imgPath}" style="width:100%; height:100%; image-rendering:pixelated;">
                    </div>` : '';

                const labelText = btnConfig.label || btnConfig.text || 'OK';

                btn.innerHTML = `
                    ${imgHTML}
                    <span style="position:relative; z-index:1;">${labelText}</span>
                `;

                btn.onclick = () => {
                    if (this.inputLockTimer > 0) return;
                    this.executeAction(btnConfig.action);
                };

                this.buttonsContainer.appendChild(btn);
                this.buttons.push({ element: btn, config: btnConfig });

                // Level-up alert special: initially disable the OK (dismiss) button
                if (this.activeAlert.id === 'level_up' && btnConfig.action === 'dismiss') {
                    btn.style.opacity = '0.5';
                    btn.style.filter = 'grayscale(1)';
                    btn.style.cursor = 'default';
                }
            });
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
            this.portrait.src = step.portrait.startsWith('/') ? step.portrait : `/${step.portrait}`;
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

    updateButtonSelection() {
        this.buttons.forEach((b, i) => {
            const img = b.element.querySelector('img');
            const isLevelUpOK = this.activeAlert?.id === 'level_up' && b.config.action === 'dismiss' && (this.activeAlert.data.pickedCount || 0) < 1;

            if (i === this.selectedButtonIndex && !isLevelUpOK) {
                b.element.style.transform = 'scale(1.1)';
                if (img) img.style.filter = 'brightness(1.2)';
            } else {
                b.element.style.transform = 'scale(1.0)';
                if (img) img.style.filter = 'none';
                
                // Keep the "disabled" look for OK button if applicable
                if (isLevelUpOK) {
                    b.element.style.opacity = '0.5';
                    b.element.style.filter = 'grayscale(1)';
                }
            }
        });
    }

    executeAction(action) {
        if (action === 'dismiss') {
            if (this.activeAlert.id === 'level_up') {
                const pickedCount = this.activeAlert.data.pickedCount || 0;
                if (pickedCount < 1) {
                    console.log("Must pick at least one topping!");
                    return;
                }
            }
            this.advance();
        } else if (action === 'restart') {
            window.location.reload();
        } else if (action && action.type === 'unlock_topping') {
            if (this.activeAlert.data.pickedCount === undefined) this.activeAlert.data.pickedCount = 0;
            
            // Check if already picked (robustness)
            if (this.activeAlert.data.unlockedToppings === undefined) this.activeAlert.data.unlockedToppings = new Set();
            if (this.activeAlert.data.unlockedToppings.has(action.toppingId)) return;

            // Unlock!
            this.game.unlockTopping(action.toppingId);
            this.activeAlert.data.pickedCount++;
            this.activeAlert.data.unlockedToppings.add(action.toppingId);

            // Visual feedback on the button
            const btn = this.buttons.find(b => b.config.action === action);
            if (btn) {
                btn.element.style.filter = 'grayscale(1) brightness(0.5)';
                btn.element.style.pointerEvents = 'none';
                const span = btn.element.querySelector('span');
                if (span) span.innerText = 'GOT IT!';
            }

            // Enable the OK button if this is the first pick
            if (this.activeAlert.data.pickedCount === 1) {
                const okBtn = this.buttons.find(b => b.config.action === 'dismiss');
                if (okBtn) {
                    okBtn.element.style.opacity = '1.0';
                    okBtn.element.style.filter = 'url(#cleanOutline)';
                    okBtn.element.style.cursor = 'pointer';
                }
            }

            if (this.activeAlert.data.pickedCount >= 3) {
                // Keep open to let player hit OK? 
                // User said "ok button to dismiss... selectable after one thing is taken"
                // I'll stay open so they can click OK.
                this.contentText.innerHTML = `MAX REACHED! <br> Press OK to continue!`;
            } else {
                // Update text to show progress
                this.contentText.innerHTML = `UNLOCKED! <br> Pick more or press OK to finish!<br>(${this.activeAlert.data.pickedCount}/3)`;
            }
        }
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

        // Requirement check for level_up alert: Must have picked at least one
        if (this.activeAlert.id === 'level_up') {
            const pickedCount = this.activeAlert.data.pickedCount || 0;
            if (pickedCount < 1) {
                // Shake or something? for now just return
                console.log("Must pick at least one topping!");
                return;
            }
        }

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
            this.game.playRandomSong();
        }

        if (cb) {
            cb();
        }
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

        // Button Navigation
        if (this.buttons.length > 0) {
            if (isRight) {
                this.selectedButtonIndex = (this.selectedButtonIndex + 1) % this.buttons.length;
                this.updateButtonSelection();
                return true;
            } else if (isLeft) {
                this.selectedButtonIndex = (this.selectedButtonIndex - 1 + this.buttons.length) % this.buttons.length;
                this.updateButtonSelection();
                return true;
            } else if (isInteract) {
                const btn = this.buttons[this.selectedButtonIndex];
                if (btn) this.executeAction(btn.config.action);
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
