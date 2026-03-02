// Nuxt Pattern: Composables in composables/ are auto-imported across the app.
// useState() is Nuxt's SSR-safe shared state primitive — unlike ref(), it is
// serialised in the server response and hydrated on the client without mismatch.
export function useTheme() {
    // useState key must be unique across the app
    const theme = useState<string>('theme', () => 'light');

    const toggleTheme = () => {
        theme.value = theme.value === 'light' ? 'dark' : 'light';
    };

    // Apply theme attribute to <html> on client side only
    // (document is not available during SSR)
    if (import.meta.client) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme && theme.value !== savedTheme) {
            theme.value = savedTheme;
        }

        watch(theme, (newTheme) => {
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        }, { immediate: true });
    }

    return { theme, toggleTheme };
}
