/**
 * Keyboard and Mouse Input Controller Module for 'I Need to Get Out of This Place'
 * Tracks continuous key holds and coordinates click projections.
 */

const OrbitControlsManager = (function () {
    const keysPressed = {};

    // Keyboard event listeners
    window.addEventListener("keydown", (e) => {
        // Track continuous hold
        keysPressed[e.key.toLowerCase()] = true;

        // Immediate trigger hotkeys
        if (e.key === "[") {
            if (window.OrbitCampaign) OrbitCampaign.changeWarp(-1);
        }
        if (e.key === "]") {
            if (window.OrbitCampaign) OrbitCampaign.changeWarp(1);
        }
        if (e.key === " ") {
            e.preventDefault();
            if (window.OrbitCampaign) OrbitCampaign.triggerSpaceAction();
        }
        if (e.key === "Escape") {
            if (window.OrbitCampaign) OrbitCampaign.deletePlannedNode();
        }
        if (e.key === "n" || e.key === "N") {
            if (window.OrbitCampaign) OrbitCampaign.placeNodeAtApogee();
        }
        if (e.key === "x" || e.key === "X") {
            if (window.OrbitCampaign) OrbitCampaign.cutThrust();
        }
        if (e.key === "m" || e.key === "M") {
            if (window.OrbitCampaign) OrbitCampaign.toggleMapMode();
        }
    });

    window.addEventListener("keyup", (e) => {
        keysPressed[e.key.toLowerCase()] = false;
    });

    /**
     * Checks if a specific key is currently held down.
     * @param {string} key - The key name (e.g. 'shift', 'w', 'a')
     * @returns {boolean}
     */
    function isHeld(key) {
        return !!keysPressed[key.toLowerCase()];
    }

    return {
        isHeld
    };
})();
