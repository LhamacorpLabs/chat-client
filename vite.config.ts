import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';

function getAppVersion(): string {
	if (process.env.APP_VERSION) {
		return process.env.APP_VERSION;
	}

	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch (error) {
		console.warn('Could not get git commit ID:', error);
		return 'unknown';
	}
}

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),

			compilerOptions: {
				warningFilter: (warning) => {
					if (warning.code === 'a11y_click_events_have_key_events') return false;
					if (warning.code === 'a11y_no_static_element_interactions') return false;
					return true;
				}
			},

			// SvelteKit 3 removed the built-in $lib alias
			alias: { $lib: 'src/lib' },

			// Use static adapter for nginx deployment
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: true
			})
		}),
		svelteTesting()
	],
	define: {
		__APP_VERSION__: JSON.stringify(getAppVersion()),
		global: 'globalThis'
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/tests/setup.ts'],
		globals: true
	}
});
