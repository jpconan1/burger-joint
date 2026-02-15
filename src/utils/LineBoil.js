
/**
 * LineBoil Utility
 * 
 * A smarter, centralized way to handle "line boil" (nervous jitter) animations.
 * Provides both CSS-based solutions for DOM elements and data-capture solutions
 * for specialized cases like border-images.
 */
export const LineBoil = {
    /**
     * Applies a CSS-based boiling effect to an element.
     * This is the preferred method for DOM elements as it is highly performant.
     * 
     * @param {HTMLElement} el - The target element.
     * @param {Object} options - Configuration.
     * @param {string} [options.image] - Spritesheet URL.
     * @param {string} [options.orientation='horizontal'] - 'horizontal' or 'vertical'.
     */
    apply(el, options = {}) {
        const {
            image,
            orientation = 'horizontal'
        } = options;

        if (image) {
            el.style.backgroundImage = `url(${image})`;
        }

        if (orientation === 'horizontal') {
            el.classList.add('boiling-horizontal');
            el.classList.remove('boiling-vertical');
        } else {
            el.classList.add('boiling-vertical');
            el.classList.remove('boiling-horizontal');
        }
    },

    /**
     * Removes the boiling effect from an element.
     */
    remove(el) {
        el.classList.remove('boiling-horizontal', 'boiling-vertical');
    },

    /**
     * Captures frames from a spritesheet dynamically.
     * Useful for border-image-source swapping where CSS animations are limited.
     * 
     * @param {string} src - The spritesheet URL.
     * @param {number} frameCount - Number of frames in the sheet.
     * @param {string} orientation - 'horizontal' or 'vertical'.
     * @returns {Promise<string[]>} List of Data URLs for each frame.
     */
    async captureFrames(src, frameCount = 3, orientation = 'vertical') {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                const w = orientation === 'horizontal' ? img.width / frameCount : img.width;
                const h = orientation === 'vertical' ? img.height / frameCount : img.height;

                canvas.width = w;
                canvas.height = h;

                const frames = [];
                for (let i = 0; i < frameCount; i++) {
                    ctx.clearRect(0, 0, w, h);
                    const sx = orientation === 'horizontal' ? i * w : 0;
                    const sy = orientation === 'vertical' ? i * h : 0;

                    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
                    frames.push(canvas.toDataURL());
                }
                resolve(frames);
            };
            img.onerror = reject;
        });
    }
};
