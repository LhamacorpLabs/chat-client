import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import {
	applyTheme as applyThemeToDocument,
	getPreferredTheme,
	type Theme
} from '@lhamacorplabs/design-tokens';

export type { Theme };

export type ThemeId =
	'light' | 'dark' | 'nord' | 'dracula' | 'gruvbox' | 'solarized-light' | 'rose-dawn';

export interface ThemeOption {
	id: ThemeId;
	label: string;
	/** Base light/dark mode (drives data-theme and the shared tokens). */
	mode: Theme;
	/** Preview swatch: [background, accent]. Also --app-bg for the theme-color meta. */
	swatch: [string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
	{ id: 'light', label: 'Light', mode: 'light', swatch: ['#ffffff', '#7c6fee'] },
	{ id: 'dark', label: 'Dark', mode: 'dark', swatch: ['#0c0c10', '#9184d9'] },
	{ id: 'nord', label: 'Nord', mode: 'dark', swatch: ['#2e3440', '#88c0d0'] },
	{ id: 'dracula', label: 'Dracula', mode: 'dark', swatch: ['#282a36', '#bd93f9'] },
	{ id: 'gruvbox', label: 'Gruvbox', mode: 'dark', swatch: ['#282828', '#fabd2f'] },
	{
		id: 'solarized-light',
		label: 'Solarized Light',
		mode: 'light',
		swatch: ['#fdf6e3', '#268bd2']
	},
	{ id: 'rose-dawn', label: 'Rosé Dawn', mode: 'light', swatch: ['#faf4ed', '#b4637a'] }
];

const PALETTE_KEY = 'palette';

function findOption(id: string | null): ThemeOption | undefined {
	return THEME_OPTIONS.find(option => option.id === id);
}

// Default theme
const defaultTheme: Theme = 'light';

// Base light/dark mode
export const theme = writable<Theme>(defaultTheme);

// Selected theme id (a named palette, or plain light/dark)
export const themeId = writable<ThemeId>(defaultTheme);

// Apply to document: data-theme + 'theme' localStorage come from the shared
// design-tokens package; data-palette, 'palette' localStorage and the
// theme-color meta tag (tints mobile browser chrome) are this app's concern.
function applyOption(option: ThemeOption) {
	if (!browser) return;
	applyThemeToDocument(option.mode);

	const isPalette = option.id !== 'light' && option.id !== 'dark';
	const root = document.documentElement;
	try {
		if (isPalette) {
			root.setAttribute('data-palette', option.id);
			localStorage.setItem(PALETTE_KEY, option.id);
		} else {
			root.removeAttribute('data-palette');
			localStorage.removeItem(PALETTE_KEY);
		}
	} catch {
		// storage unavailable - theme still applies for this session
	}
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', option.swatch[0]);
}

export function setTheme(id: ThemeId) {
	const option = findOption(id);
	if (!option) return;
	theme.set(option.mode);
	themeId.set(option.id);
	applyOption(option);
}

// Load theme from localStorage (or system preference) on app start
export function loadTheme() {
	if (!browser) return;
	let stored: string | null = null;
	try {
		stored = localStorage.getItem(PALETTE_KEY);
	} catch {
		// ignore
	}
	const palette = findOption(stored);
	if (palette && palette.id !== 'light' && palette.id !== 'dark') {
		setTheme(palette.id);
		return;
	}
	setTheme(getPreferredTheme());
}

// Toggle between plain light and dark
export function toggleTheme() {
	setTheme(get(theme) === 'light' ? 'dark' : 'light');
}
