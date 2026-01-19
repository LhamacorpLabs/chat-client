import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

// Default theme
const defaultTheme: Theme = 'light';

// Create the theme store
export const theme = writable<Theme>(defaultTheme);

// Load theme from localStorage on app start
export function loadTheme() {
	if (browser) {
		const savedTheme = localStorage.getItem('theme') as Theme;
		if (savedTheme === 'light' || savedTheme === 'dark') {
			theme.set(savedTheme);
			applyTheme(savedTheme);
		} else {
			// Check system preference
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			const systemTheme = prefersDark ? 'dark' : 'light';
			theme.set(systemTheme);
			applyTheme(systemTheme);
		}
	}
}

// Toggle between themes
export function toggleTheme() {
	theme.update(currentTheme => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		if (browser) {
			localStorage.setItem('theme', newTheme);
			applyTheme(newTheme);
		}
		return newTheme;
	});
}

// Apply theme to document
function applyTheme(themeValue: Theme) {
	if (browser) {
		document.documentElement.setAttribute('data-theme', themeValue);
	}
}