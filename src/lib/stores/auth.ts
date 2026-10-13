import { writable, derived } from 'svelte/store';
import type { AuthResponse, User } from '../types/auth';
import {
	refreshToken as apiRefreshToken,
	refreshSession as apiRefreshSession,
	startRefreshableSession as apiStartRefreshableSession,
	revokeRefreshToken,
	TokenRefreshError
} from '../api/auth';
import {
	hydrateAuthFromPersistentStore,
	persistAuthData,
	clearPersistedAuthData,
	loadRefreshToken,
	saveRefreshToken,
	clearRefreshToken,
	getCachedRefreshToken
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
			} catch {
				localStorage.removeItem('auth_data');
			}
		}
	}
	authLoaded.set(true);
}

export function logout() {
	// Grab the refresh token before anything is cleared so the server can end
	// the session too; otherwise a copied token would stay valid until it expires.
	void endServerSession(getCachedRefreshToken());

	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem('auth_data');
	}
	// Fire-and-forget: clears the on-disk Electron store too, so a stale
	// session can't get rehydrated back into localStorage on next launch.
	// Errors are already caught/logged inside clearPersistedAuthData().
	void clearPersistedAuthData();
	authStore.set(initialState);
}

async function endServerSession(knownRefreshToken: string | null) {
	// The revoke request has to start before the first await: logout() is often
	// followed straight away by a navigation to the login page.
	const token = knownRefreshToken ?? (await loadRefreshToken());
	if (token) void revokeRefreshToken(token);
	await clearRefreshToken();
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

// How long to wait before checking whether another window already rotated the
// refresh token we just tried to use.
const ROTATION_RECHECK_MS = 300;

async function doRefreshToken(): Promise<boolean> {
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.token) {
		return false;
	}

	const usedRefreshToken = await loadRefreshToken();

	try {
		// With a refresh token this works even after the access token expired
		// (app closed for days). Without one - a fresh login, or a session from
		// before refresh tokens existed - upgrade the still-valid access token.
		const refreshedData = usedRefreshToken
			? await apiRefreshSession(usedRefreshToken)
			: await upgradeToRefreshableSession(storedAuth.token);

		await applySession(refreshedData);
		return true;
	} catch (error) {
		// Only clear the session when the server explicitly rejected the
		// credentials (401/403) - that means they really are invalid. Any
		// other failure (offline, DNS not ready yet on an Electron cold start,
		// CORS misconfiguration, server hiccup, etc.) is transient: keep
		// the existing session so the user isn't forced to log in again just
		// because a background refresh couldn't reach the server.
		// checkAndRefreshToken() will retry on the next check.
		const isInvalidToken =
			error instanceof TokenRefreshError &&
			(error.status === 401 || error.status === 403);

		if (isInvalidToken) {
			if (usedRefreshToken && (await rotatedByAnotherWindow(usedRefreshToken))) {
				return true;
			}
			logout();
		} else {
			console.warn('Token refresh failed, keeping existing session and will retry later:', error);
		}

		return false;
	}
}

async function upgradeToRefreshableSession(token: string): Promise<AuthResponse> {
	try {
		return await apiStartRefreshableSession(token);
	} catch (error) {
		// Auth server that doesn't know refresh tokens yet: keep working with
		// the plain access token refresh until it is upgraded.
		if (error instanceof TokenRefreshError && (error.status === 404 || error.status === 405)) {
			return apiRefreshToken(token);
		}
		throw error;
	}
}

/**
 * Refresh tokens are single use, so two windows refreshing at once means one
 * of them gets rejected. If durable storage now holds a different token, the
 * other window won: adopt its session instead of logging the user out.
 */
async function rotatedByAnotherWindow(usedRefreshToken: string): Promise<boolean> {
	await new Promise(resolve => setTimeout(resolve, ROTATION_RECHECK_MS));

	const latest = await loadRefreshToken();
	if (!latest || latest === usedRefreshToken) {
		return false;
	}

	const storedAuth = getStoredAuthData();
	if (!storedAuth) {
		return false;
	}

	authStore.update(state => ({
		...state,
		user: {
			id: storedAuth.id,
			username: storedAuth.username,
			email: storedAuth.email,
			roles: storedAuth.roles
		},
		token: storedAuth.token
	}));
	return true;
}

async function applySession(data: AuthResponse): Promise<void> {
	const { refreshToken: newRefreshToken, ...session } = data;

	// Persist the rotated refresh token first: the old one is already spent
	// server-side, so losing the new one would end the session.
	if (newRefreshToken) {
		await saveRefreshToken(newRefreshToken);
	}

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('auth_data', JSON.stringify(session));
	}
	await persistAuthData(session);

	authStore.update(state => ({
		...state,
		user: {
			id: session.id,
			username: session.username,
			email: session.email,
			roles: session.roles
		},
		token: session.token
	}));
}

export async function checkAndRefreshToken(): Promise<boolean> {
	const storedAuth = getStoredAuthData();
	if (!storedAuth || !storedAuth.expirationDate) {
		return false;
	}

	const now = new Date().getTime();
	const expiry = new Date(storedAuth.expirationDate).getTime();
	if (expiry <= now) {
		// The access token is dead, but a refresh token can still revive the
		// session - that's what keeps the user signed in while the app was closed.
		if (await loadRefreshToken()) {
			return refreshToken();
		}

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
