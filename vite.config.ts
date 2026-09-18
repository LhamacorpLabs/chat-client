import { sveltekit } from '@sveltejs/kit/vite';
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
	plugins: [sveltekit(), svelteTesting()],
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
