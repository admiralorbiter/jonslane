/**
 * Shared Canvas Utilities for Space & Physics Visualizations
 */

export const CanvasHelpers = {
    /**
     * Scale canvas to account for device pixel ratio (sharp retina rendering)
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} ctx
     */
    setupHighDPI(canvas, ctx) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        ctx.resetTransform(); // Prevent cumulative scaling
        ctx.scale(dpr, dpr);
        return dpr;
    },

    /**
     * Map physical coordinates (x, y) to canvas drawing pixels (px, py)
     * @param {number} x - Physical X coordinate
     * @param {number} y - Physical Y coordinate
     * @param {number} width - CSS width of canvas
     * @param {number} height - CSS height of canvas
     * @param {number} scaleX - Pixels per physical unit (X axis)
     * @param {number} scaleY - Pixels per physical unit (Y axis)
     * @returns {Object} { px, py }
     */
    physicsToCanvas(x, y, width, height, scaleX, scaleY) {
        const cX = width / 2;
        const cY = height / 2;
        return {
            px: cX + x * scaleX,
            py: cY - y * scaleY // Invert Y since screen coordinates increase downward
        };
    },

    /**
     * Create a mapping between physics coordinates and canvas pixels that preserves aspect ratio.
     * Ensures that 1 physical meter is represented by equal vertical and horizontal pixels.
     * @param {number} canvasWidth
     * @param {number} canvasHeight
     * @param {number} xMin
     * @param {number} xMax
     * @param {number} yMin
     * @param {number} yMax
     * @param {number} paddingPercent
     */
    getViewportMapper(canvasWidth, canvasHeight, xMin, xMax, yMin, yMax, paddingPercent = 0.08) {
        const dx = xMax - xMin;
        const dy = yMax - yMin;
        const padX = dx * paddingPercent;
        const padY = dy * paddingPercent;

        // Virtual bounds with padding
        const xMinP = xMin - padX;
        const xMaxP = xMax + padX;
        const yMinP = yMin - padY;
        const yMaxP = yMax + padY;

        const viewDx = xMaxP - xMinP;
        const viewDy = yMaxP - yMinP;

        // Choose the smaller scaling ratio to guarantee bounds fit inside canvas
        const scale = Math.min(canvasWidth / viewDx, canvasHeight / viewDy);

        // Calculate offsets to center the virtual bounds in the physical canvas
        const xOffset = (canvasWidth - viewDx * scale) / 2 - xMinP * scale;
        const yOffset = (canvasHeight - viewDy * scale) / 2 + yMaxP * scale; // Inverted Y-axis

        return {
            scale,
            toPixels(x, y) {
                return {
                    px: xOffset + x * scale,
                    py: yOffset - y * scale
                };
            },
            toPhysics(px, py) {
                return {
                    x: (px - xOffset) / scale,
                    y: (yOffset - py) / scale
                };
            }
        };
    },

    /**
     * Draw a vector arrow on the canvas
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} startX - Start pixel position X
     * @param {number} startY - Start pixel position Y
     * @param {number} endX - End pixel position X
     * @param {number} endY - End pixel position Y
     * @param {string} color - Arrow color hex/rgb string
     * @param {number} width - Arrow line width
     */
    drawArrow(ctx, startX, startY, endX, endY, color, width = 2) {
        const headlen = 8; // Length of head in pixels
        const dx = endX - startX;
        const dy = endY - startY;

        // Don't draw if length is negligible
        if (Math.sqrt(dx*dx + dy*dy) < 3) return;

        const angle = Math.atan2(dy, dx);

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    }
};
