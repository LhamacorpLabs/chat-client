import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
	{
		ignores: [
			'build/**',
			'.svelte-kit/**',
			'release/**',
			'node_modules/**',
			'static/**',
			// Vendored/legacy plain-JS updater scripts; svelte-check already
			// flags their implicit-any params separately, not re-litigating
			// that here.
			'electron/mac-update/**',
			// eslint-plugin-svelte's flat/recommended config applies some of
			// its rules with no file restriction, and at least
			// svelte/no-inner-declarations crashes when it hits a plain
			// CommonJS .cjs file (TypeError: Cannot read properties of null
			// (reading 'isStrict')). These are plain Node/Electron
			// main-process scripts, not part of the Svelte/TS app - excluded
			// rather than worked around until that's fixed upstream.
			'**/*.cjs'
		]
	},
	js.configs.recommended,
	...tsPlugin.configs['flat/recommended'],
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.es2021,
				// Injected by vite.config.ts's `define`, declared as an
				// ambient global in src/app.d.ts.
				__APP_VERSION__: 'readonly'
			}
		}
	},
	{
		// Let svelte-eslint-parser hand <script lang="ts"> blocks to the
		// TypeScript parser.
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser
			}
		}
	},
	{
		files: ['vite.config.ts', 'svelte.config.js', 'src/tests/**/*.ts'],
		languageOptions: {
			globals: globals.node
		}
	},
	{
		rules: {
			// Common in this codebase for API responses / third-party event
			// payloads where a precise type isn't worth modeling yet.
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
		}
	}
];
