import { ASSETS } from '../constants.js';

export class MenuRenderer {
    constructor(game) {
        this.game = game;
        this.overlay = null;
        this.elements = {};

        // Preview Canvas for dynamic burger rendering
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.width = 96;
        this.previewCanvas.height = 96;
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.previewCtx.imageSmoothingEnabled = false;
    }

    render(menuSystem, renderer) {
        if (!this.overlay) {
            this.initOverlay();
        }

        const isVisible = (this.game.gameState === 'MENU_CUSTOM');
        this.overlay.style.display = isVisible ? 'flex' : 'none';

        if (isVisible) {
            this.updateOverlay(menuSystem, renderer);
        }
    }

    initOverlay() {
        // Main Container
        const container = document.createElement('div');
        container.id = 'custom-menu-overlay';
        container.style.display = 'none';

        // Background
        const bg = document.createElement('div');
        bg.className = 'cbm-bg';

        // Logo
        const logo = document.createElement('div');
        logo.className = 'cbm-logo';

        // Complexity
        const complexity = document.createElement('div');
        complexity.className = 'cbm-complexity';

        // Grid
        const grid = document.createElement('div');
        grid.className = 'cbm-grid';

        // 4 Burger Slots
        const slots = [];
        for (let i = 0; i < 4; i++) {
            const slot = document.createElement('div');
            slot.className = 'cbm-slot';
            slot.dataset.index = i;

            // Selector
            const selector = document.createElement('div');
            selector.className = 'cbm-selector';
            slot.appendChild(selector);

            // Button/Header (The 64x64 clickable part)
            const btn = document.createElement('img');
            btn.className = 'cbm-slot-button';
            slot.appendChild(btn);

            // Preview
            const preview = document.createElement('img');
            preview.className = 'cbm-slot-preview';
            slot.appendChild(preview);

            // Name
            const name = document.createElement('div');
            name.className = 'cbm-slot-name';
            slot.appendChild(name);

            grid.appendChild(slot);
            slots.push({ el: slot, btn, preview, name, selector });
        }

        // Aux Row
        const auxRow = document.createElement('div');
        auxRow.className = 'cbm-aux-row';

        const auxSlots = [];
        for (let i = 4; i < 6; i++) {
            const slot = document.createElement('div');
            slot.className = 'cbm-aux-slot';
            slot.dataset.index = i;

            const selector = document.createElement('div');
            selector.className = 'cbm-selector';
            slot.appendChild(selector);

            const btn = document.createElement('img');
            btn.className = 'cbm-slot-button'; // Reuse style
            slot.appendChild(btn);

            const label = document.createElement('div');
            label.className = 'cbm-slot-name'; // Reuse style
            label.textContent = (i === 4) ? 'SIDES' : 'DRINKS';
            slot.appendChild(label);

            auxRow.appendChild(slot);
            auxSlots.push({ el: slot, btn, selector });
        }

        // Submenu
        const submenu = document.createElement('div');
        submenu.className = 'cbm-submenu';
        submenu.style.display = 'none';

        const submenuGrid = document.createElement('div');
        submenuGrid.className = 'cbm-submenu-grid';
        submenu.appendChild(submenuGrid);

        // Naming Overlay
        const naming = document.createElement('div');
        naming.className = 'cbm-naming';
        naming.style.display = 'none';

        const namingInput = document.createElement('input');
        namingInput.readOnly = true; // Input is handled by game keys, not browser focus
        naming.appendChild(namingInput);

        // Assemble
        bg.appendChild(logo);
        bg.appendChild(complexity);
        bg.appendChild(grid);
        bg.appendChild(auxRow);
        bg.appendChild(submenu); // On top of BG content.
        bg.appendChild(naming); // Covers BG

        container.appendChild(bg);

        // Append to UI Layer
        const ui = document.getElementById('ui-layer');
        if (ui) ui.appendChild(container);

        // Store References
        this.overlay = container;
        this.elements = {
            bg,
            logo,
            complexity,
            slots,
            auxSlots,
            submenu,
            submenuGrid,
            naming,
            namingInput,
        };

        // Cache static assets
        this.setAsset(logo, ASSETS.UI.MENU_LOGO, 'background-image');
        this.setAsset(bg, ASSETS.UI.MENU_BG, 'background-image');
        this.setAsset(submenu, ASSETS.UI.TICKET_BG, 'background-image');

        slots.forEach(s => {
            this.setAsset(s.selector, ASSETS.UI.SELECTOR, 'background-image');
        });
        auxSlots.forEach(s => {
            this.setAsset(s.selector, ASSETS.UI.SELECTOR, 'background-image');
        });
    }

    setAsset(element, assetKey, prop = 'src') {
        const asset = this.game.assetLoader.get(assetKey);
        if (!asset) return;

        let url = '';
        if (asset instanceof HTMLCanvasElement) {
            url = asset.toDataURL();
        } else if (asset instanceof HTMLImageElement) {
            url = asset.src;
        }

        if (prop === 'src') {
            element.src = url;
            element.style.display = 'block'; // Ensure visible if it was hidden
        } else if (prop === 'background-image') {
            element.style.backgroundImage = `url(${url})`;
        }
    }

    getAssetUrl(assetKey) {
        const asset = this.game.assetLoader.get(assetKey);
        if (!asset) return '';
        if (asset instanceof HTMLCanvasElement) return asset.toDataURL();
        if (asset instanceof HTMLImageElement) return asset.src;
        return '';
    }

    updateOverlay(menuSystem, renderer) {
        const els = this.elements;

        // 1. Complexity
        els.complexity.textContent = `Complexity: ${menuSystem.calculateComplexity()}`;

        // 2. Main Slots
        for (let i = 0; i < 4; i++) {
            const slot = menuSystem.menuSlots[i];
            const dom = els.slots[i];

            // Selection Class
            if (menuSystem.selectedButtonIndex === i) {
                dom.el.classList.add('selected');
            } else {
                dom.el.classList.remove('selected');
            }

            // Content
            if (slot) {
                this.setAsset(dom.btn, ASSETS.UI.CHECKERBOARD_BUTTON, 'src');
                dom.name.textContent = slot.name;
                dom.preview.style.display = 'block';

                // Render burger preview to canvas and set as src
                // Clear temp canvas
                this.previewCtx.clearRect(0, 0, 96, 96);
                // Draw burger (using modified renderer method)
                renderer.drawBurgerPixels(slot, 0, 0, 1.5, this.previewCtx);
                dom.preview.src = this.previewCanvas.toDataURL();

            } else {
                this.setAsset(dom.btn, ASSETS.UI.ADD_BURGER_BUTTON, 'src');
                dom.name.textContent = '';
                dom.preview.style.display = 'none';
            }
        }

        // 3. Aux Slots
        for (let i = 4; i < 6; i++) {
            const dom = els.auxSlots[i - 4];
            const isSelected = (menuSystem.selectedButtonIndex === i);
            if (isSelected) dom.el.classList.add('selected');
            else dom.el.classList.remove('selected');

            // Set Icons
            if (i === 4) this.setAsset(dom.btn, ASSETS.UI.ADD_SIDE_BUTTON, 'src');
            else this.setAsset(dom.btn, ASSETS.UI.ADD_DRINK_BUTTON, 'src');
        }

        // 4. Submenu
        if (menuSystem.expandedSlotIndex !== null) {
            els.submenu.style.display = 'flex';

            const isBurger = (menuSystem.expandedSlotIndex < 4);

            // attach to the specific slot so relative positioning works
            const targetSlot = isBurger
                ? els.slots[menuSystem.expandedSlotIndex].el
                : els.auxSlots[menuSystem.expandedSlotIndex - 4].el;

            // Fix for overlapping preview: push menu down for burgers
            if (isBurger) {
                els.submenu.style.top = '140px';
            } else {
                els.submenu.style.top = ''; // Revert to CSS default (70px)
            }

            if (targetSlot && els.submenu.parentElement !== targetSlot) {
                targetSlot.appendChild(els.submenu);
            }

            this.updateSubmenu(menuSystem);
        } else {
            els.submenu.style.display = 'none';
        }

        // 5. Naming
        if (menuSystem.namingMode) {
            els.naming.style.display = 'flex';
            els.namingInput.value = menuSystem.tempName;
        } else {
            els.naming.style.display = 'none';
        }
    }

    updateSubmenu(menuSystem) {
        const els = this.elements;
        const grid = els.submenuGrid;

        // Clear current content
        grid.innerHTML = '';

        const slotIndex = menuSystem.expandedSlotIndex;
        let isBurger = slotIndex < 4;

        let list = [];
        if (isBurger) {
            const slot = menuSystem.menuSlots[slotIndex];
            list = slot ? slot.state.toppings : [];
        } else if (slotIndex === 4) {
            list = menuSystem.sides;
        } else if (slotIndex === 5) {
            list = menuSystem.drinks;
        }

        // Items Construction matches handleInput logic
        const itemsToRender = [];

        // 1. Bun/Patty (Burger Only)
        if (isBurger) {
            const slot = menuSystem.menuSlots[slotIndex];
            itemsToRender.push({ type: 'bun', label: 'BUN', state: slot.state.bun });
        }

        // 2. List Items
        list.forEach((item, idx) => {
            const type = isBurger ? 'topping' : (slotIndex === 4 ? 'side' : 'drink');
            itemsToRender.push({ type, index: idx, state: item });
        });

        // 3. Add Button
        itemsToRender.push({ type: 'add' });


        // Render Cells
        itemsToRender.forEach((item, idx) => {
            const cell = document.createElement('div');
            cell.className = 'cbm-sub-item';

            const isSelected = (menuSystem.subButtonIndex === idx);
            if (isSelected) cell.classList.add('selected');

            // Background
            let bgKey = ASSETS.UI.BUTTON_BACKGROUND;

            // Icon
            let iconUrl = '';

            if (item.type === 'add') {
                iconUrl = this.getAssetUrl(ASSETS.UI.PLUS_BUTTON);
            } else {
                if (item.state && item.state.optional) bgKey = ASSETS.UI.BUTTON_BACKGROUND_OPTIONAL;

                // Content Icon logic
                // Find definition
                let def = null;
                let collection = [];
                if (item.type === 'bun') collection = menuSystem.buns;
                else if (item.type === 'topping') collection = menuSystem.toppings;
                else if (item.type === 'side') collection = menuSystem.availableSides;
                else if (item.type === 'drink') collection = menuSystem.availableDrinks;

                if (item.state) {
                    def = collection.find(d => d.id === item.state.definitionId) || (collection[0]);
                }

                // Special case for cooked patties / drinks
                let tex = def ? def.texture : null;
                if (item.type === 'drink' && def && def.sign) {
                    tex = def.sign;
                }
                if (item.type === 'topping' && def && def.textures && def.textures.rules) {
                    // Check if it's a patty-like thing that cooks? Or just check if "beef_patty" or similar rules
                    // The Original code had: if (item.type === 'patty' && ...)
                    // But now everything is 'topping'.
                    // So we should check if the def has cooked texture rules.

                    const cookedRule = def.textures.rules.find(r => r.value === 'cooked');
                    if (cookedRule) tex = cookedRule.texture;
                }

                if (tex) iconUrl = this.getAssetUrl(tex);
            }

            cell.style.backgroundImage = `url(${this.getAssetUrl(bgKey)})`;

            if (iconUrl) {
                const iconFn = document.createElement('img');
                iconFn.className = 'icon';
                iconFn.src = iconUrl;
                cell.appendChild(iconFn);
            }

            // Selection arrows (if active selection mode)
            if (isSelected && menuSystem.selectionMode && item.type !== 'add') {
                const arrowUrl = this.getAssetUrl(ASSETS.UI.BUTTON_ARROWS);
                if (arrowUrl) {
                    const arrowEl = document.createElement('img');
                    arrowEl.src = arrowUrl;
                    arrowEl.style.position = 'absolute';
                    arrowEl.style.width = '100%';
                    arrowEl.style.height = '100%';
                    cell.appendChild(arrowEl);
                }
            }

            grid.appendChild(cell);
        });

        // Scroll
        const selectedEl = grid.children[menuSystem.subButtonIndex];
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }
}
