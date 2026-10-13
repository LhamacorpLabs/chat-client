import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$env/static/public', () => ({
	PUBLIC_CHAT_API_URL: 'http://localhost:8080'
}));

const { MockTokenRefreshError } = vi.hoisted(() => {
	class MockTokenRefreshError extends Error {
		status?: number;
		constructor(message: string, status?: number) {
			super(message);
			this.name = 'TokenRefreshError';
			this.status = status;
		}
	}
	return { MockTokenRefreshError };
});

vi.mock('$lib/api/auth', () => ({
	refreshToken: vi.fn(),
	refreshSession: vi.fn(),
	startRefreshableSession: vi.fn(),
	revokeRefreshToken: vi.fn(),
	TokenRefreshError: MockTokenRefreshError
}));

import {
	authStore,
	authLoaded,
	checkAndRefreshToken,
	getValidToken,
	loadAuth,
	logout,
	refreshToken
} from '$lib/stores/auth';
import {
	refreshToken as apiLegacyRefresh,
	refreshSession as apiRefreshSession,
	startRefreshableSession as apiStartSession,
	revokeRefreshToken as apiRevoke
} from '$lib/api/auth';
import {
	saveRefreshToken,
	loadRefreshToken,
	clearRefreshToken
} from '$lib/utils/persistentStore';

const HOUR = 60 * 60 * 1000;

function session(overrides: Record<string, unknown> = {}) {
	return {
		id: '1',
		username: 'user',
		email: 'u@e.com',
		roles: ['USER'],
		token: 'access-1',
		expirationDate: new Date(Date.now() + 100 * HOUR).toISOString(),
		...overrides
	};
}

function storeSession(data: Record<string, unknown>) {
	localStorage.setItem('auth_data', JSON.stringify(data));
	authStore.set({
		user: { id: '1', username: 'user', email: 'u@e.com', roles: ['USER'] },
		token: data.token as string,
		isLoading: false,
		error: null
	});
}

beforeEach(async () => {
	vi.clearAllMocks();
	localStorage.clear();
	await clearRefreshToken();
	authStore.set({ user: null, token: null, isLoading: false, error: null });
	authLoaded.set(false);
});

describe('refresh tokens keep the user signed in while the app was closed', () => {
	it('revives a session whose access token expired days ago', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() - 3 * 24 * HOUR).toISOString() }));
		await saveRefreshToken('refresh-1');
		vi.mocked(apiRefreshSession).mockResolvedValue(
			session({
				token: 'access-2',
				refreshToken: 'refresh-2',
				refreshExpirationDate: new Date(Date.now() + 60 * 24 * HOUR).toISOString()
			})
		);

		const result = await checkAndRefreshToken();

		expect(result).toBe(true);
		expect(apiRefreshSession).toHaveBeenCalledWith('refresh-1');
		expect(get(authStore).token).toBe('access-2');
		expect(await getValidToken()).toBe('access-2');
	});

	it('stores the rotated refresh token and keeps it out of auth_data', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() - HOUR).toISOString() }));
		await saveRefreshToken('refresh-1');
		vi.mocked(apiRefreshSession).mockResolvedValue(
			session({ token: 'access-2', refreshToken: 'refresh-2' })
		);

		await checkAndRefreshToken();

		expect(await loadRefreshToken()).toBe('refresh-2');
		expect(localStorage.getItem('auth_data')).not.toContain('refresh-2');
		expect(localStorage.getItem('auth_data')).not.toContain('refreshToken');
	});

	it('refreshes with the refresh token when the access token is about to expire', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() + 5 * HOUR).toISOString() }));
		await saveRefreshToken('refresh-1');
		vi.mocked(apiRefreshSession).mockResolvedValue(
			session({ token: 'access-2', refreshToken: 'refresh-2' })
		);

		expect(await checkAndRefreshToken()).toBe(true);
		expect(apiRefreshSession).toHaveBeenCalledWith('refresh-1');
		expect(apiStartSession).not.toHaveBeenCalled();
	});

	it('does not touch the network while the access token is still fresh', async () => {
		storeSession(session());
		await saveRefreshToken('refresh-1');

		expect(await checkAndRefreshToken()).toBe(true);
		expect(apiRefreshSession).not.toHaveBeenCalled();
	});

	it('logs out when the server rejects the refresh token', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() - HOUR).toISOString() }));
		await saveRefreshToken('refresh-1');
		vi.mocked(apiRefreshSession).mockRejectedValue(new MockTokenRefreshError('rejected', 401));

		const result = await checkAndRefreshToken();

		expect(result).toBe(false);
		expect(get(authStore).token).toBeNull();
		expect(localStorage.getItem('auth_data')).toBeNull();
		expect(await loadRefreshToken()).toBeNull();
	});

	it('keeps the session when the refresh fails because the network is down', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() - HOUR).toISOString() }));
		await saveRefreshToken('refresh-1');
		vi.mocked(apiRefreshSession).mockRejectedValue(new MockTokenRefreshError('offline'));

		const result = await checkAndRefreshToken();

		expect(result).toBe(false);
		expect(localStorage.getItem('auth_data')).not.toBeNull();
		expect(await loadRefreshToken()).toBe('refresh-1');
	});

	it('adopts the session of another window that rotated the token first', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() - HOUR).toISOString() }));
		await saveRefreshToken('refresh-1');
		vi.mocked(apiRefreshSession).mockImplementation(async () => {
			// The other window finishes its refresh while ours is being rejected.
			localStorage.setItem('auth_data', JSON.stringify(session({ token: 'access-other' })));
			localStorage.setItem('refresh_token', 'refresh-other');
			throw new MockTokenRefreshError('already used', 401);
		});

		const result = await refreshToken();

		expect(result).toBe(true);
		expect(get(authStore).token).toBe('access-other');
		expect(localStorage.getItem('auth_data')).not.toBeNull();
	});
});

describe('sessions without a refresh token (fresh login or pre-upgrade)', () => {
	it('upgrades a valid access token to a refreshable session', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() + 5 * HOUR).toISOString() }));
		vi.mocked(apiStartSession).mockResolvedValue(
			session({ token: 'access-1', refreshToken: 'refresh-1' })
		);

		expect(await refreshToken()).toBe(true);
		expect(apiStartSession).toHaveBeenCalledWith('access-1');
		expect(await loadRefreshToken()).toBe('refresh-1');
	});

	it('falls back to the plain refresh when the server has no refresh tokens yet', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() + 5 * HOUR).toISOString() }));
		vi.mocked(apiStartSession).mockRejectedValue(new MockTokenRefreshError('missing', 404));
		vi.mocked(apiLegacyRefresh).mockResolvedValue(session({ token: 'access-legacy' }));

		expect(await refreshToken()).toBe(true);
		expect(get(authStore).token).toBe('access-legacy');
	});

	it('logs out when the access token expired and there is no refresh token', async () => {
		storeSession(session({ expirationDate: new Date(Date.now() - HOUR).toISOString() }));

		expect(await checkAndRefreshToken()).toBe(false);
		expect(get(authStore).token).toBeNull();
		expect(apiRefreshSession).not.toHaveBeenCalled();
	});
});

describe('logout', () => {
	it('revokes the refresh token on the server and forgets it locally', async () => {
		storeSession(session());
		await saveRefreshToken('refresh-1');

		logout();

		expect(apiRevoke).toHaveBeenCalledWith('refresh-1');
		await vi.waitFor(async () => expect(await loadRefreshToken()).toBeNull());
		expect(localStorage.getItem('auth_data')).toBeNull();
	});

	it('still works when no refresh token exists', async () => {
		storeSession(session());

		logout();

		expect(apiRevoke).not.toHaveBeenCalled();
		expect(get(authStore).token).toBeNull();
	});
});

describe('logout in Electron, where the refresh token is only readable asynchronously', () => {
	afterEach(() => {
		delete (window as { electronAPI?: unknown }).electronAPI;
	});

	it('revokes synchronously because loadAuth() already loaded the token', async () => {
		const secrets = new Map<string, string>([['refresh_token', 'refresh-electron']]);
		(window as { electronAPI?: unknown }).electronAPI = {
			isElectron: true,
			store: {
				get: vi.fn().mockResolvedValue(undefined),
				set: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined)
			},
			secret: {
				get: vi.fn(async (key: string) => secrets.get(key)),
				set: vi.fn(async (key: string, value: string) => void secrets.set(key, value)),
				delete: vi.fn(async (key: string) => void secrets.delete(key))
			}
		};
		// Fresh access token: loadAuth() does not need to refresh anything.
		localStorage.setItem('auth_data', JSON.stringify(session()));

		await loadAuth();
		expect(apiRefreshSession).not.toHaveBeenCalled();

		logout();

		// No await between logout() and the assertion: the page may navigate right after.
		expect(apiRevoke).toHaveBeenCalledWith('refresh-electron');
		await vi.waitFor(() => expect(secrets.has('refresh_token')).toBe(false));
	});
});
