import { writable, derived } from 'svelte/store';
import type { AuthResponse, User } from '../types/auth';
import { refreshToken as apiRefreshToken, TokenRefreshError } from '../api/auth';
import {
	hydrateAuthFromPersistentStore,
	persistAuthData,
	clearPersistedAuthData
} from '../utils/persistentStore';

interface AuthState {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	error: string | null;
}

const initialState: AuthState = {
	user: null,
	token: null,
	isLoading: false,
	error: null
};

export const authStore = writable<AuthState>(initialState);

export const authLoaded = writable(false);

export const isAuthenticated = derived(authStore, $auth => !!$auth.token);

export async function loadAuth() {
	// On Electron, localStorage inside the renderer isn't always reliably
	// persisted across full app restarts. Before reading localStorage,
	// restore it from the durable on-disk Electron store if localStorage came
	// up empty - a no-op everywhere else (web, or when localStorage still
	// has the session).
	await hydrateAuthFromPersistentStore();

	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('auth_data');
		if (saved) {
			try {
				const authData: AuthResponse = JSON.parse(saved);
				const user: User = {
					id: authData.id,
					username: authData.username,
					email: authData.email,
					roles: authData.roles
				};
				authStore.set({
					user,
					token: authData.token,
					isLoading: false,
					error: null
				});

				await checkAndRefreshToken();
			} catch (e) {
				localStorage.removeItem('auth_data');
			}
		}
	}
	authLoaded.set(true);
}

export function logout() {
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('auth_data');
	}
	// Fire-and-forget: clears the on-disk Electron store too, so a stale
	// session can't get rehydrated back into localStorage on next launch.
	// Errors are already caught/logged inside clearPersistedAuthData().
	void clearPersistedAuthData();
	authStore.set(initialState);
}

function isTokenExpiringSoon(expirationDate: string, minutes: number = 30): boolean {
	const now = new Date().getTime();
	const expiry = new Date(expirationDate).getTime();
	const timeUntilExpiry = expiry - now;
	const minutesUntilExpiry = timeUntilExpiry / (1000 * 60);
	return minutesUntilExpiry <= minutes;
}

function getStoredAuthData(): AuthResponse | null {
	if (typeof localStorage === 'undefined') return null;

	const saved = localStorage.getItem('auth_data');
	if (!saved) return null;

	try {
		return JSON.parse(saved) as AuthResponse;
	} catch {
		return null;
	}
}

let refreshInProgress: Promise<boolean> | null = null;

export async function refreshToken(): Promise<boolean> {
	if (refreshInProgress) {
		return refreshInProgress;
	}

	refreshInProgress = doRefreshToken();
	try {
		return await refreshInProgress;
	} finally {
		refreshInProgress = null;
	}
}

async function doRefreshToken(): Promise<boolean> {
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.token) {
		return false;
	}

	try {
		const refreshedData = await apiRefreshToken(storedAuth.token);

		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('auth_data', JSON.stringify(refreshedData));
		}
		await persistAuthData(refreshedData);

		const user: User = {
			id: refreshedData.id,
			username: refreshedData.username,
			email: refreshedData.email,
			roles: refreshedData.roles
		};

		authStore.update(state => ({
			...state,
			user,
			token: refreshedData.token
		}));

		return true;
	} catch (error) {
		// Only clear the session when the server explicitly rejected the
		// token (401/403) - that means the token really is invalid. Any
		// other failure (offline, DNS not ready yet on an Electron cold start,
		// CORS misconfiguration, server hiccup, etc.) is transient: keep
		// the existing, still-unexpired token so the user isn't forced to
		// log in again just because a background refresh couldn't reach
		// the server. checkAndRefreshToken() will still catch genuinely
		// expired tokens on the next check.
		const isInvalidToken =
			error instanceof TokenRefreshError &&
			(error.status === 401 || error.status === 403);

		if (isInvalidToken) {
			logout();
		} else {
			console.warn('Token refresh failed, keeping existing session and will retry later:', error);
		}

		return false;
	}
}

export async function checkAndRefreshToken(): Promise<boolean> {
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.expirationDate) {
		return false;
	}

	const now = new Date().getTime();
	const expiry = new Date(storedAuth.expirationDate).getTime();
	if (expiry <= now) {
		logout();
		return false;
	}

	if (isTokenExpiringSoon(storedAuth.expirationDate, 2880)) {
		const refreshed = await refreshToken();
		if (refreshed) {
			return true;
		}

		// Refresh didn't succeed. If it failed for a transient reason
		// (see doRefreshToken), logout() was NOT called and the session is
		// still on disk with a token that hasn't actually expired yet -
		// keep treating it as valid rather than signing the user out.
		return getStoredAuthData() !== null;
	}

	return true;
}

export async function getValidToken(): Promise<string | null> {
	const refreshed = await checkAndRefreshToken();
	if (!refreshed) {
		return null;
	}

	const authState = getStoredAuthData();
	return authState?.token || null;
}
