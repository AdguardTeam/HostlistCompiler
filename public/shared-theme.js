/**
 * Shared Theme Management - Adblock Compiler
 * Handles dark/light mode toggle with localStorage persistence
 */

(function () {
    'use strict';

    // Theme configuration
    const STORAGE_KEY = 'adblock-compiler-theme';
    const DARK_THEME = 'dark';
    const LIGHT_THEME = 'light';

    /**
     * Get the current theme from localStorage or system preference
     */
    function getStoredTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return stored;
        }
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return DARK_THEME;
        }
        return LIGHT_THEME;
    }

    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateToggleButton(theme);
    }

    /**
     * Update toggle button text and icon
     */
    function updateToggleButton(theme) {
        const iconEl = document.getElementById('theme-icon');
        const labelEl = document.getElementById('theme-label');

        if (iconEl) {
            iconEl.textContent = theme === DARK_THEME ? '☀️' : '🌙';
        }
        if (labelEl) {
            labelEl.textContent = theme === DARK_THEME ? 'Light Mode' : 'Dark Mode';
        }
    }

    /**
     * Toggle between light and dark themes
     */
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || LIGHT_THEME;
        const newTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;

        localStorage.setItem(STORAGE_KEY, newTheme);
        applyTheme(newTheme);
    }

    /**
     * Initialize theme on page load
     */
    function initTheme() {
        const theme = getStoredTheme();
        applyTheme(theme);

        // Add click handler to toggle button
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                // Only update if user hasn't manually set a preference
                if (!localStorage.getItem(STORAGE_KEY)) {
                    applyTheme(e.matches ? DARK_THEME : LIGHT_THEME);
                }
            });
        }
    }

    /**
     * Create theme toggle button HTML
     * Call this function and insert the result into your header
     */
    function createThemeToggleHTML() {
        return `
            <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
                <span class="theme-toggle-icon" id="theme-icon">🌙</span>
                <span class="theme-toggle-label" id="theme-label">Dark Mode</span>
            </button>
        `;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    // Expose functions globally for manual usage
    window.AdblockTheme = {
        toggle: toggleTheme,
        get: getStoredTheme,
        set: function (theme) {
            localStorage.setItem(STORAGE_KEY, theme);
            applyTheme(theme);
        },
        createToggleHTML: createThemeToggleHTML,
    };
})();
