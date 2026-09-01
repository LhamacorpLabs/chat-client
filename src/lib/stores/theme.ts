import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
	applyTheme as applyThemeToDocument,
	getPreferredTheme,
	type Theme
} from '@lhamacorplabs/design-tokens';

export type { Theme };

// Default theme
const defaultTheme: Theme = 'light';

// Create the theme store
export const theme = writable<Theme>(defaultTheme);

// Matches the --bg-gradient start color in @lhamacorplabs/design-tokens
// (v2) for each theme, so mobile browser chrome (Safari's status bar /
// toolbar) tints to match the page instead of defaulting to white.
const THEME_COLORS: Record<Theme, string> = {
	light: '#f5f5f7',
	dark: '#0d0d10'
};

// Apply theme to document: data-theme attribute + localStorage persistence
// come from the shared design-tokens package; the theme-color meta tag is
// this app's own mobile-chrome-tinting concern.
function applyTheme(themeValue: Theme) {
	if (!browser) return;
	applyThemeToDocument(themeValue);
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[themeValue]);
}

// Load theme from localStorage (or system preference) on app start
export function loadTheme() {
	if (!browser) return;
	const preferred = getPreferredTheme();
	theme.set(preferred);
	applyTheme(preferred);
}

// Toggle between themes
export function toggleTheme() {
	theme.update(currentTheme => {
		const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';
		applyTheme(newTheme);
		return newTheme;
	});
}
