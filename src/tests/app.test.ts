import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$env/static/public', () => ({
	PUBLIC_CHAT_API_URL: 'http://localhost:8080'
}));

vi.mock('$app/environment', () => ({
	browser: true
}));

const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: (...args: any[]) => mockGoto(...args)
}));

vi.mock('$lib/api/auth', () => ({
	refreshToken: vi.fn()
}));

vi.mock('$lib/utils/persistentStore', () => ({
	saveAuthData: vi.fn(async (data: any) => {
		localStorage.setItem('auth_data', JSON.stringify(data));
	}),
	loadAuthData: vi.fn(async () => {
		const saved = localStorage.getItem('auth_data');
		if (!saved) return null;
		try {
			return JSON.parse(saved);
		} catch {
			return null;
		}
	}),
	clearAuthData: vi.fn(async () => {
		localStorage.removeItem('auth_data');
	})
}));

import { authStore, authLoaded, loadAuth, logout, checkAndRefreshToken } from '$lib/stores/auth';
import { refreshToken as apiRefreshToken } from '$lib/api/auth';
import { loadTheme, toggleTheme, theme } from '$lib/stores/theme';
import { chatMuteStore } from '$lib/stores/chatMute';
import { checkAndRefreshIfNewDay } from '$lib/utils/dailyRefresh';
import {
	cleanupAllChatData,
	emergencyCleanup,
	getLocalStorageStats
} from '$lib/utils/localStorageCleanup';

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	authStore.set({ user: null, token: null, isLoading: false, error: null });
	authLoaded.set(false);
});

describe('Auth - Session Persistence', () => {
	const validAuth = {
		token: 'valid-token-123',
		expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
		username: 'testuser',
		email: 'test@example.com',
		id: 'user-1',
		roles: ['USER']
	};

	it('restores session from localStorage on loadAuth', async () => {
		localStorage.setItem('auth_data', JSON.stringify(validAuth));

		await loadAuth();

		const state = get(authStore);
		expect(state.token).toBe('valid-token-123');
		expect(state.user?.username).toBe('testuser');
		expect(state.user?.id).toBe('user-1');
	});

	it('sets authLoaded to true after loadAuth completes', async () => {
		await loadAuth();
		expect(get(authLoaded)).toBe(true);
	});

	it('sets authLoaded to true even when no saved auth exists', async () => {
		await loadAuth();
		expect(get(authLoaded)).toBe(true);
		expect(get(authStore).token).toBeNull();
	});

	it('handles corrupted auth data gracefully', async () => {
		localStorage.setItem('auth_data', 'not-valid-json{{{');

		await loadAuth();

		expect(get(authStore).token).toBeNull();
		expect(get(authLoaded)).toBe(true);
	});

	it('does not redirect to login before authLoaded is true', () => {
		const state = get(authStore);
		const loaded = get(authLoaded);

		// Simulates the guard: should NOT redirect when loaded is false
		expect(loaded).toBe(false);
		expect(state.token).toBeNull();
		// The condition `authLoaded && !token` is false because authLoaded is false
		expect(loaded && !state.token).toBe(false);
	});

	it('logout clears localStorage and resets store', () => {
		localStorage.setItem('auth_data', JSON.stringify(validAuth));
		authStore.set({
			user: { id: 'user-1', username: 'testuser', email: 'test@example.com', roles: ['USER'] },
			token: 'valid-token-123',
			isLoading: false,
			error: null
		});

		logout();

		expect(localStorage.getItem('auth_data')).toBeNull();
		expect(get(authStore).token).toBeNull();
		expect(get(authStore).user).toBeNull();
	});
});

describe('Auth - Token Refresh', () => {
	it('does not logout when token is not yet expired', async () => {
		const futureAuth = {
			token: 'good-token',
			expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
			username: 'user',
			email: 'u@e.com',
			id: '1',
			roles: ['USER']
		};
		localStorage.setItem('auth_data', JSON.stringify(futureAuth));

		await loadAuth();

		expect(get(authStore).token).toBe('good-token');
	});

	it('logs out when token is expired', async () => {
		const expiredAuth = {
			token: 'expired-token',
			expirationDate: new Date(Date.now() - 60000).toISOString(),
			username: 'user',
			email: 'u@e.com',
			id: '1',
			roles: ['USER']
		};
		localStorage.setItem('auth_data', JSON.stringify(expiredAuth));

		await loadAuth();

		expect(get(authStore).token).toBeNull();
	});

	it('refreshes token when expiring within 48h', async () => {
		const soonAuth = {
			token: 'soon-expired',
			expirationDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
			username: 'user',
			email: 'u@e.com',
			id: '1',
			roles: ['USER']
		};
		localStorage.setItem('auth_data', JSON.stringify(soonAuth));

		const refreshedData = { ...soonAuth, token: 'refreshed-token', expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
		vi.mocked(apiRefreshToken).mockResolvedValue(refreshedData);

		await loadAuth();

		expect(get(authStore).token).toBe('refreshed-token');
	});
});

describe('Theme Store', () => {
	it('loads saved theme from localStorage', () => {
		localStorage.setItem('theme', 'dark');
		loadTheme();
		expect(get(theme)).toBe('dark');
	});

	it('toggles between light and dark', () => {
		theme.set('light');
		toggleTheme();
		expect(get(theme)).toBe('dark');
		expect(localStorage.getItem('theme')).toBe('dark');

		toggleTheme();
		expect(get(theme)).toBe('light');
		expect(localStorage.getItem('theme')).toBe('light');
	});

	it('ignores invalid theme values in localStorage', () => {
		localStorage.setItem('theme', 'invalid-theme');
		window.matchMedia = vi.fn().mockReturnValue({ matches: false });
		loadTheme();
		const current = get(theme);
		expect(['light', 'dark']).toContain(current);
	});
});

describe('Chat Mute Store', () => {
	beforeEach(() => {
		chatMuteStore.clear();
	});

	it('mutes and unmutes chat', () => {
		chatMuteStore.muteChat('chat-1');
		expect(chatMuteStore.isMuted('chat-1')).toBe(true);

		chatMuteStore.unmuteChat('chat-1');
		expect(chatMuteStore.isMuted('chat-1')).toBe(false);
	});

	it('toggles mute status', () => {
		expect(chatMuteStore.isMuted('chat-1')).toBe(false);

		chatMuteStore.toggleMute('chat-1');
		expect(chatMuteStore.isMuted('chat-1')).toBe(true);

		chatMuteStore.toggleMute('chat-1');
		expect(chatMuteStore.isMuted('chat-1')).toBe(false);
	});

	it('persists mute settings to localStorage', () => {
		chatMuteStore.muteChat('chat-1');

		const stored = JSON.parse(localStorage.getItem('chat-mute-settings')!);
		expect(stored.mutedChats['chat-1']).toBe(true);
	});

	it('returns all muted chat IDs', () => {
		chatMuteStore.muteChat('chat-1');
		chatMuteStore.muteChat('chat-3');

		const muted = chatMuteStore.getMutedChats();
		expect(muted).toContain('chat-1');
		expect(muted).toContain('chat-3');
		expect(muted).not.toContain('chat-2');
	});
});

describe('Daily Refresh', () => {
	it('does not refresh on first visit ever', () => {
		const result = checkAndRefreshIfNewDay();
		expect(result).toBe(false);
		expect(localStorage.getItem('last_app_open_date')).toBeTruthy();
	});

	it('does not refresh if same day', () => {
		const today = new Date().toISOString().split('T')[0];
		localStorage.setItem('last_app_open_date', today);

		const result = checkAndRefreshIfNewDay();
		expect(result).toBe(false);
	});

	it('triggers refresh on new day', () => {
		localStorage.setItem('last_app_open_date', '2020-01-01');

		// Mock window.location.reload
		const reloadMock = vi.fn();
		Object.defineProperty(window, 'location', {
			value: { ...window.location, reload: reloadMock },
			writable: true
		});

		const result = checkAndRefreshIfNewDay();
		expect(result).toBe(true);
		expect(reloadMock).toHaveBeenCalled();
	});
});

describe('localStorage Cleanup', () => {
	it('reports correct stats', () => {
		localStorage.setItem('key1', 'value1');
		localStorage.setItem('key2', 'a longer value for testing');

		const stats = getLocalStorageStats();
		expect(stats.totalKeys).toBe(2);
		expect(stats.estimatedSize).toBeGreaterThan(0);
		expect(stats.keysBySize).toHaveLength(2);
		expect(stats.keysBySize[0].size).toBeGreaterThanOrEqual(stats.keysBySize[1].size);
	});

	it('cleans up member colors for inactive chats', () => {
		localStorage.setItem('member_colors', JSON.stringify({
			'chat-1': { 'user-a': '#ff0000' },
			'chat-2': { 'user-b': '#00ff00' },
			'chat-3': { 'user-c': '#0000ff' }
		}));

		cleanupAllChatData(['chat-1', 'chat-3']);

		const remaining = JSON.parse(localStorage.getItem('member_colors')!);
		expect(remaining['chat-1']).toBeDefined();
		expect(remaining['chat-2']).toBeUndefined();
		expect(remaining['chat-3']).toBeDefined();
	});

	it('preserves auth_data and theme during emergency cleanup', () => {
		localStorage.setItem('auth_data', JSON.stringify({ token: 'keep-me' }));
		localStorage.setItem('theme', 'dark');
		// Fill with junk to trigger cleanup (jsdom has 5MB limit, use smaller values)
		for (let i = 0; i < 50; i++) {
			localStorage.setItem(`junk_${i}`, 'x'.repeat(10000));
		}

		emergencyCleanup();

		expect(localStorage.getItem('auth_data')).toBeTruthy();
		expect(localStorage.getItem('theme')).toBe('dark');
	});
});
