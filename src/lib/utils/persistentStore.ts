import type { AuthResponse } from '../types/auth';

const STORE_KEY = 'auth_data';

type ElectronStore = NonNullable<Window['electronAPI']>['store'];

function getElectronStore(): ElectronStore | undefined {
	if (typeof window === 'undefined' || !window.electronAPI) return undefined;
	return window.electronAPI.store;
}

/**
 * localStorage persistence inside a webview isn't reliable on every
 * platform/webview version - there are documented cases (particularly on
 * macOS/WKWebView-based shells) where it doesn't survive an app restart
 * even though the app itself, and the rest of its data directory, persists
 * fine. The Electron desktop build instead writes to an actual JSON file in
 * the app's userData directory (via the main process), which is far more
 * dependable.
 *
 * Rather than rewrite every one of the many call sites across the app that
 * read `localStorage.getItem('auth_data')` synchronously, localStorage
 * stays the primary, synchronous source of truth. This function just
 * hydrates it from the durable on-disk store at startup, but ONLY when
 * localStorage came up empty - so it restores a session that the webview
 * failed to persist, without ever clobbering a live one.
 */
export async function hydrateAuthFromPersistentStore(): Promise<void> {
	if (typeof localStorage === 'undefined') return;
	if (localStorage.getItem(STORE_KEY)) return;

	const store = getElectronStore();
	if (!store) return;

	try {
		const data = await store.get<AuthResponse>(STORE_KEY);
		if (data) {
			localStorage.setItem(STORE_KEY, JSON.stringify(data));
		}
	} catch (error) {
		console.warn('Failed to hydrate auth session from persistent store:', error);
	}
}

export async function persistAuthData(data: AuthResponse): Promise<void> {
	const store = getElectronStore();
	if (!store) return;

	try {
		await store.set(STORE_KEY, data);
	} catch (error) {
		console.warn('Failed to persist auth session to disk store:', error);
	}
}

export async function clearPersistedAuthData(): Promise<void> {
	const store = getElectronStore();
	if (!store) return;

	try {
		await store.delete(STORE_KEY);
	} catch (error) {
		console.warn('Failed to clear persisted auth session:', error);
	}
}

const REFRESH_TOKEN_KEY = 'refresh_token';

// The refresh token is long-lived and can mint new access tokens, so it is
// kept out of the `auth_data` blob (which is copied around freely). In
// Electron it lives in the main process, encrypted with the OS keychain; on the
// web it is a separate localStorage entry. The in-memory copy lets logout()
// send the revoke request synchronously before the page navigates away.
let cachedRefreshToken: string | null = null;

function getElectronSecrets() {
	if (typeof window === 'undefined' || !window.electronAPI) return undefined;
	return window.electronAPI.secret;
}

/** Reads the refresh token from durable storage (not from the cache), so a token rotated by another tab is seen. */
export async function loadRefreshToken(): Promise<string | null> {
	const secrets = getElectronSecrets();

	try {
		if (secrets) {
			cachedRefreshToken = (await secrets.get(REFRESH_TOKEN_KEY)) ?? null;
		} else if (typeof localStorage !== 'undefined') {
			cachedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
		}
	} catch (error) {
		console.warn('Failed to load refresh token:', error);
	}

	return cachedRefreshToken;
}

/**
 * Synchronous read for logout(), which must fire the revoke request before the
 * page navigates away. Falls back to localStorage on the web when nothing has
 * been loaded yet; in Electron the secret is only reachable asynchronously.
 */
export function getCachedRefreshToken(): string | null {
	if (cachedRefreshToken) return cachedRefreshToken;
	if (getElectronSecrets() || typeof localStorage === 'undefined') return null;

	try {
		return localStorage.getItem(REFRESH_TOKEN_KEY);
	} catch {
		return null;
	}
}

export async function saveRefreshToken(token: string): Promise<void> {
	cachedRefreshToken = token;
	const secrets = getElectronSecrets();

	try {
		if (secrets) {
			await secrets.set(REFRESH_TOKEN_KEY, token);
		} else if (typeof localStorage !== 'undefined') {
			localStorage.setItem(REFRESH_TOKEN_KEY, token);
		}
	} catch (error) {
		console.warn('Failed to persist refresh token:', error);
	}
}

export async function clearRefreshToken(): Promise<void> {
	cachedRefreshToken = null;
	const secrets = getElectronSecrets();

	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(REFRESH_TOKEN_KEY);
		}
		if (secrets) {
			await secrets.delete(REFRESH_TOKEN_KEY);
		}
	} catch (error) {
		console.warn('Failed to clear refresh token:', error);
	}
}
