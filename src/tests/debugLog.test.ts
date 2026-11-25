import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';

describe('debug log', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	async function setup(fetchImpl: typeof fetch) {
		window.fetch = fetchImpl;
		localStorage.setItem('debug_enabled', '1');
		const mod = await import('$lib/stores/debugLog');
		mod.clearDebugLog();
		mod.installFetchLogger();
		return mod;
	}

	it('records each request with its method, status and duration', async () => {
		const { debugLog } = await setup(vi.fn().mockResolvedValue(new Response('{}', { status: 201 })));

		await fetch('https://api.example.com/api/chats', { method: 'post' });

		const [entry] = get(debugLog);
		expect(entry).toMatchObject({ kind: 'http', label: 'POST', detail: 'https://api.example.com/api/chats', status: 201, pending: false });
		expect(entry.durationMs).toBeGreaterThanOrEqual(0);
	});

	it('records failed requests and still rethrows the error', async () => {
		const { debugLog } = await setup(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		await expect(fetch('https://api.example.com/api/chats')).rejects.toThrow('Failed to fetch');

		expect(get(debugLog)[0]).toMatchObject({ label: 'GET', error: 'Failed to fetch', pending: false });
	});

	it('masks credentials in query strings', async () => {
		const { debugLog } = await setup(vi.fn().mockResolvedValue(new Response('')));

		await fetch('https://api.example.com/ws?token=secret-value&chat=1');

		const { detail } = get(debugLog)[0];
		expect(detail).not.toContain('secret-value');
		expect(detail).toContain('chat=1');
	});

	it('only wraps fetch once', async () => {
		const original = vi.fn().mockResolvedValue(new Response(''));
		const { debugLog, installFetchLogger } = await setup(original);
		installFetchLogger();

		await fetch('https://api.example.com/a');

		expect(get(debugLog)).toHaveLength(1);
		expect(original).toHaveBeenCalledTimes(1);
	});

	it('keeps only the most recent 200 entries', async () => {
		const { debugLog, logDebugEvent } = await setup(vi.fn());

		for (let i = 0; i < 250; i++) logDebugEvent('auth', `event ${i}`);

		const entries = get(debugLog);
		expect(entries).toHaveLength(200);
		expect(entries[entries.length - 1].label).toBe('event 249');
	});

	describe('opt-in', () => {
		beforeEach(() => localStorage.clear());

		it('is disabled by default and records nothing', async () => {
			window.fetch = vi.fn().mockResolvedValue(new Response('{}'));
			const mod = await import('$lib/stores/debugLog');
			mod.installFetchLogger();

			await fetch('https://api.example.com/api/chats');
			mod.logDebugEvent('auth', 'refresh');

			expect(get(mod.debugEnabled)).toBe(false);
			expect(get(mod.debugLog)).toHaveLength(0);
		});

		it('/debug on turns it on persistently and /debug off clears and closes it', async () => {
			const mod = await import('$lib/stores/debugLog');

			expect(mod.runDebugCommand('/debug on')).toMatch(/on/);
			expect(get(mod.debugEnabled)).toBe(true);
			expect(localStorage.getItem('debug_enabled')).toBe('1');

			mod.logDebugEvent('mqtt', 'connect');
			mod.debugPanelOpen.set(true);
			expect(get(mod.debugLog)).toHaveLength(1);

			expect(mod.runDebugCommand(' /DEBUG OFF ')).toMatch(/off/);
			expect(get(mod.debugEnabled)).toBe(false);
			expect(get(mod.debugPanelOpen)).toBe(false);
			expect(get(mod.debugLog)).toHaveLength(0);
			expect(localStorage.getItem('debug_enabled')).toBeNull();
		});

		it('ignores ordinary messages', async () => {
			const mod = await import('$lib/stores/debugLog');
			expect(mod.runDebugCommand('hello /debug on')).toBeNull();
			expect(mod.runDebugCommand('/debugger')).toBeNull();
		});

		it('/debug with no argument toggles', async () => {
			const mod = await import('$lib/stores/debugLog');
			mod.runDebugCommand('/debug');
			expect(get(mod.debugEnabled)).toBe(true);
			mod.runDebugCommand('/debug');
			expect(get(mod.debugEnabled)).toBe(false);
		});
	});
});
