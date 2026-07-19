import { describe, it, expect, vi, beforeEach } from 'vitest';
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
	TokenRefreshError: MockTokenRefreshError
}));

import { authStore, authLoaded, checkAndRefreshToken } from '$lib/stores/auth';
import { refreshToken as apiRefreshToken } from '$lib/api/auth';

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	authStore.set({ user: null, token: null, isLoading: false, error: null });
	authLoaded.set(false);
});

describe('Auth refresh regression (Electron cold-start logout bug)', () => {
	it('does NOT log out when refresh fails for a transient/network reason', async () => {
		const soonAuth = {
			token: 'soon-expired',
			expirationDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
			username: 'user',
			email: 'u@e.com',
			id: '1',
			roles: ['USER']
		};
		localStorage.setItem('auth_data', JSON.stringify(soonAuth));
		authStore.set({
			user: { id: '1', username: 'user', email: 'u@e.com', roles: ['USER'] },
			token: 'soon-expired',
			isLoading: false,
			error: null
		});

		vi.mocked(apiRefreshToken).mockRejectedValue(new Error('Failed to fetch'));

		const result = await checkAndRefreshToken();

		expect(result).toBe(true);
		expect(get(authStore).token).toBe('soon-expired');
		expect(localStorage.getItem('auth_data')).not.toBeNull();
	});

	it('DOES log out when the server explicitly rejects the token (401)', async () => {
		const { TokenRefreshError } = await import('$lib/api/auth');
		const soonAuth = {
			token: 'rejected-token',
			expirationDate: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
			username: 'user',
			email: 'u@e.com',
			id: '1',
			roles: ['USER']
		};
		localStorage.setItem('auth_data', JSON.stringify(soonAuth));
		authStore.set({
			user: { id: '1', username: 'user', email: 'u@e.com', roles: ['USER'] },
			token: 'rejected-token',
			isLoading: false,
			error: null
		});

		vi.mocked(apiRefreshToken).mockRejectedValue(new TokenRefreshError('Token refresh failed', 401));

		const result = await checkAndRefreshToken();

		expect(result).toBe(false);
		expect(get(authStore).token).toBeNull();
		expect(localStorage.getItem('auth_data')).toBeNull();
	});

	it('still logs out when the token is actually expired', async () => {
		const expiredAuth = {
			token: 'expired-token',
			expirationDate: new Date(Date.now() - 60000).toISOString(),
			username: 'user',
			email: 'u@e.com',
			id: '1',
			roles: ['USER']
		};
		localStorage.setItem('auth_data', JSON.stringify(expiredAuth));

		const result = await checkAndRefreshToken();

		expect(result).toBe(false);
		expect(get(authStore).token).toBeNull();
	});
});
