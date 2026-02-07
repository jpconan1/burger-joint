
export class UISystem {

    /**
     * Creates a standard "Post-Day" style button.
     * @param {Object} config
     * @param {string} config.id - Data ID for the button
     * @param {string} [config.label] - Text label
     * @param {string} [config.icon] - Icon URL (optional)
     * @param {boolean} [config.isReroll] - Special reroll button styling
     * @param {boolean} [config.isSupply] - Special supply button styling
     * @param {Function} [config.onClick] - Click handler (optional, usually handled by system via ID)
     * @param {Array<string>} [config.classes] - Additional CSS classes
     * @returns {HTMLElement}
     */
    static createButton(config) {
        const el = document.createElement('div');
        el.className = 'menu-item';
        if (config.classes) config.classes.forEach(c => el.classList.add(c));

        if (config.id) el.dataset.id = config.id;

        // Random transform variables for the "messy/organic" feel
        el.style.setProperty('--rand-x', (Math.random() * 8 - 4) + 'px');
        el.style.setProperty('--rand-y', (Math.random() * 8 - 4) + 'px');
        el.style.setProperty('--rand-rot', (Math.random() * 10 - 5) + 'deg');
        el.style.setProperty('--rand-text-rot', (Math.random() * 6 - 3) + 'deg');

        if (config.variant === 'image' || config.isReroll) {
            // Image-only / Custom Variant
            el.style.background = 'none';
            el.style.border = 'none';

            if (config.isReroll) {
                el.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <div class="boil-bg"></div>
                        <img class="item-icon" src="assets/ui/reroll.png" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1.0); z-index: 1; image-rendering: pixelated;">
                    </div>
                    <div class="label item-text" style="position: absolute; top: -55px; width: 200%; left: -50%; text-align: center; font-size: 1rem; color: white;">Reroll</div>
                 `;
            } else {
                // Generic Image Container (consumer fills content or we add plain image)
                // If config.icon is provided, use it as main image
                if (config.icon) {
                    el.innerHTML = `<img src="${config.icon}" style="display:block; width:100%; height:100%; image-rendering: pixelated;">`;
                }
                // If allow content injection
                if (config.content) {
                    el.innerHTML = config.content;
                }
            }

        } else {
            // Standard Button Structure
            // Background Animation
            // Note: PostDaySystem had .supply-card logic for background, we can assume consumer adds .supply-card class if needed
            // But we can check config.isSupply for specific inner HTML differences if any.

            const boilClass = config.isSupply ? 'supply-boil-bg' : 'boil-bg';

            let iconHTML = '';
            if (config.icon) {
                // Check if icon works with white-background logic or just simple img
                // PostDay usually uses a centered icon.
                iconHTML = `<img class="item-icon" src="${config.icon}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.8); z-index: 1; image-rendering: pixelated; max-width: 60%; max-height: 60%;">`;
            }

            let labelHTML = '';
            if (config.label) {
                // Label usually appears on hover or selection (opacity 0->1 in CSS)
                // But structure is .label.item-text
                labelHTML = `<div class="label item-text" style="position: absolute; bottom: -30px; width: 200%; left: -50%; text-align: center; font-size: 1rem; color: white; text-shadow: 2px 2px 0 #000;">${config.label}</div>`;
            }

            el.innerHTML = `
                <div style="position: relative; display: flex; justify-content: center; align-items: center; width: 100%; height: 100%;">
                    ${config.isSupply ? `<div class="${boilClass}" style="position:absolute;"></div>` : ''} 
                    ${!config.isSupply ? `<div class="${boilClass}" style="position:absolute;"></div>` : ''}
                    ${iconHTML}
                </div>
                ${labelHTML}
            `;

            // Note: PostDaySystem did more specific stuff for Rewards (cards with costs etc). 
            // Generic buttons might be simpler.
            // If the user wants EXACTLY PostDaySystem buttons, we should support passing raw innerHTML or content builder?
            // Or maybe PostDaySystem was a bit ad-hoc.
            // Let's rely on CSS classes for the main "look" (border, bg) and use this for the structure.

            // If it's a generic text button (like 'Continue'), we center the text.
            if (!config.icon && config.label && !config.isSupply && !config.isReroll) {
                el.innerHTML = `
                    <div class="item-text" style="font-family:'Permanent Marker'; font-size: 1.2rem; color: white;">${config.label}</div>
                 `;
            }
        }

        if (config.onClick) {
            el.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                config.onClick();
            });
        }

        return el;
    }
}
