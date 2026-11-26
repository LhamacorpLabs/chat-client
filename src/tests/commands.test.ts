import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

async function helpUsages(runCommand: (text: string) => Promise<unknown>): Promise<string[]> {
	const reply = (await runCommand('/help')) as { help: { usage: string }[] };
	return reply.help.map(entry => entry.usage);
}

describe('chat commands', () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
		delete (window as { electronAPI?: unknown }).electronAPI;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function load() {
		const { runCommand } = await import('$lib/commands');
		const debug = await import('$lib/stores/debugLog');
		return { runCommand, ...debug };
	}

	it('treats ordinary text and unknown commands as normal messages', async () => {
		const { runCommand } = await load();
		expect(await runCommand('hello')).toBeNull();
		expect(await runCommand('/shrug')).toBeNull();
		expect(await runCommand('/debugger')).toBeNull();
		expect(await runCommand('hello /help')).toBeNull();
	});

	it('is case-insensitive and ignores surrounding whitespace', async () => {
		const { runCommand } = await load();
		expect(await runCommand('  /VERSION ')).toMatch(/^Lhama Chat/);
	});

	describe('/debug', () => {
		it('turns debug mode on persistently and off again, clearing and closing it', async () => {
			const { runCommand, debugEnabled, debugLog, debugPanelOpen, logDebugEvent } = await load();

			expect(await runCommand('/debug on')).toMatch(/on/);
			expect(get(debugEnabled)).toBe(true);
			expect(localStorage.getItem('debug_enabled')).toBe('1');

			logDebugEvent('mqtt', 'connect');
			debugPanelOpen.set(true);
			expect(get(debugLog)).toHaveLength(1);

			expect(await runCommand('/debug off')).toMatch(/off/);
			expect(get(debugEnabled)).toBe(false);
			expect(get(debugPanelOpen)).toBe(false);
			expect(get(debugLog)).toHaveLength(0);
			expect(localStorage.getItem('debug_enabled')).toBeNull();
		});

		it('toggles with no argument and leaves /debug <junk> as a normal message', async () => {
			const { runCommand, debugEnabled } = await load();
			await runCommand('/debug');
			expect(get(debugEnabled)).toBe(true);
			await runCommand('/debug');
			expect(get(debugEnabled)).toBe(false);
			expect(await runCommand('/debug maybe')).toBeNull();
			expect(await runCommand('/debug on now')).toBeNull();
		});

		it('is only listed by /help once enabled', async () => {
			const { runCommand } = await load();
			expect(await helpUsages(runCommand)).not.toContain('/debug [on|off]');
			await runCommand('/debug on');
			expect(await helpUsages(runCommand)).toContain('/debug [on|off]');
		});
	});

	it('/help opens the command list rather than posting text', async () => {
		const { runCommand } = await load();
		const usages = await helpUsages(runCommand);
		for (const name of ['/help', '/version', '/update', '/mute', '/theme', '/clear-cache']) {
			expect(usages.some(usage => usage.startsWith(name))).toBe(true);
		}
		const reply = await runCommand('/help');
		expect(typeof reply).toBe('object');
		expect((reply as { help: { description: string }[] }).help.every(entry => entry.description)).toBe(true);
	});

	describe('/mute', () => {
		it('mutes and unmutes the current chat with on and off', async () => {
			const { runCommand } = await load();
			const { chatMuteStore } = await import('$lib/stores/chatMute');

			expect(await runCommand('/mute on', { chatId: 'c1' })).toBe('Chat muted.');
			expect(get(chatMuteStore).mutedChats.c1).toBe(true);

			expect(await runCommand('/mute on', { chatId: 'c1' })).toBe('Chat muted.');
			expect(get(chatMuteStore).mutedChats.c1).toBe(true);

			expect(await runCommand('/mute off', { chatId: 'c1' })).toBe('Chat unmuted.');
			expect(get(chatMuteStore).mutedChats.c1).toBe(false);
		});

		it('toggles with no argument, per chat', async () => {
			const { runCommand } = await load();
			const { chatMuteStore } = await import('$lib/stores/chatMute');

			await runCommand('/mute', { chatId: 'c1' });
			expect(get(chatMuteStore).mutedChats.c1).toBe(true);
			expect(get(chatMuteStore).mutedChats.c2).toBeUndefined();

			await runCommand('/mute', { chatId: 'c1' });
			expect(get(chatMuteStore).mutedChats.c1).toBe(false);
		});

		it('leaves /mute <junk> as a normal message and needs a chat', async () => {
			const { runCommand } = await load();
			expect(await runCommand('/mute please', { chatId: 'c1' })).toBeNull();
			expect(await runCommand('/mute')).toBe('Open a chat first.');
		});
	});

	describe('/theme', () => {
		it('lists themes with no argument', async () => {
			const { runCommand } = await load();
			expect(await runCommand('/theme')).toContain('nord');
		});

		it('switches by id or label, ignoring case and punctuation', async () => {
			const { runCommand } = await load();
			const { themeId } = await import('$lib/stores/theme');

			await runCommand('/theme Nord');
			expect(get(themeId)).toBe('nord');

			await runCommand('/theme rose dawn');
			expect(get(themeId)).toBe('rose-dawn');

			await runCommand('/theme Rosé Dawn');
			expect(get(themeId)).toBe('rose-dawn');

			await runCommand('/theme solarized light');
			expect(get(themeId)).toBe('solarized-light');
		});

		it('reports unknown themes without changing anything', async () => {
			const { runCommand } = await load();
			const { themeId } = await import('$lib/stores/theme');
			const before = get(themeId);

			expect(await runCommand('/theme neon')).toMatch(/Unknown theme "neon"/);
			expect(get(themeId)).toBe(before);
		});
	});

	describe('/update', () => {
		it('says it is desktop only on the web', async () => {
			const { runCommand } = await load();
			expect(await runCommand('/update')).toMatch(/desktop app/);
		});

		it('runs the updater check in the desktop app', async () => {
			const check = vi.fn().mockResolvedValue(true);
			(window as { electronAPI?: unknown }).electronAPI = { updater: { check } };
			const { runCommand } = await load();

			expect(await runCommand('/update')).toMatch(/Checked for updates/);
			expect(check).toHaveBeenCalledOnce();
		});

		it('reports a failed check', async () => {
			const check = vi.fn().mockRejectedValue(new Error('offline'));
			(window as { electronAPI?: unknown }).electronAPI = { updater: { check } };
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const { runCommand } = await load();

			expect(await runCommand('/update')).toMatch(/failed/);
		});

		it('does not re-check when an update is already downloaded', async () => {
			const check = vi.fn();
			(window as { electronAPI?: unknown }).electronAPI = { updater: { check } };
			const { runCommand } = await load();
			const { updateReady } = await import('$lib/utils/updater');
			updateReady.set(true);

			expect(await runCommand('/update')).toMatch(/ready/);
			expect(check).not.toHaveBeenCalled();
		});
	});

	describe('/clear-cache', () => {
		it('drops cached display data, keeps the session, and reloads', async () => {
			vi.useFakeTimers();
			localStorage.setItem('member_colors', '{"c1":{}}');
			localStorage.setItem('auth_data', '{"token":"t"}');
			localStorage.setItem('chat-mute-settings', '{"mutedChats":{"c1":true}}');
			const reload = vi.fn();
			const { runCommand } = await load();

			expect(await runCommand('/clear-cache', { reload })).toMatch(/Reloading/);
			expect(localStorage.getItem('member_colors')).toBeNull();
			expect(localStorage.getItem('auth_data')).not.toBeNull();
			expect(localStorage.getItem('chat-mute-settings')).not.toBeNull();

			expect(reload).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1000);
			expect(reload).toHaveBeenCalledOnce();
		});
	});
});
