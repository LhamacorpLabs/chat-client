import { PUBLIC_AUTH_API_URL } from '$app/env/public';

const API_URL = `${PUBLIC_AUTH_API_URL || 'https://auth.lhamacorp.com'}/api`;
const REFRESH_TIMEOUT_MS = 15000;

/**
 * Thrown when a token refresh attempt fails.
 *
 * `status` is only set when the server actually responded (e.g. 401/403
 * because the token itself is invalid/expired server-side). When `status`
 * is undefined, the request never reached/completed against the server
 * (network error, DNS not ready yet, CORS failure, timeout, etc.) - that
 * is a transient failure, not proof the session is invalid.
 */
export class TokenRefreshError extends Error {
	status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.name = 'TokenRefreshError';
		this.status = status;
	}
}

export async function refreshToken(token: string): Promise<import('../types/auth').AuthResponse> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(`${API_URL}/refresh`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${token}`
			},
			signal: controller.signal
		});
	} catch {
		// fetch itself threw: no network, DNS not resolved yet, CORS preflight
		// rejected, a hung request that hit our own timeout, etc. We don't
		// know whether the token is actually invalid - treat the same as any
		// other network failure (transient, see TokenRefreshError above).
		throw new TokenRefreshError('Network error while refreshing token');
	} finally {
		clearTimeout(timeoutId);
	}

	if (!response.ok) {
		throw new TokenRefreshError('Token refresh failed', response.status);
	}

	return response.json();
}

async function postAuth(path: string, init: RequestInit): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

	try {
		return await fetch(`${API_URL}${path}`, { method: 'POST', ...init, signal: controller.signal });
	} catch {
		// Same reasoning as refreshToken(): a failed fetch is transient, not proof the session is invalid.
		throw new TokenRefreshError('Network error while refreshing token');
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Exchanges a refresh token for a new access token plus a rotated refresh
 * token. Works after the access token has expired, which is the whole point:
 * it lets the app stay signed in while it was closed. The server answers 401
 * when the refresh token is unknown, expired, revoked or already used.
 */
export async function refreshSession(
	refreshToken: string
): Promise<import('../types/auth').AuthResponse> {
	const response = await postAuth('/token/refresh', {
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ refreshToken })
	});

	if (!response.ok) {
		throw new TokenRefreshError('Session refresh failed', response.status);
	}

	return response.json();
}

/**
 * Upgrades a still-valid access token to a refreshable session. Used right
 * after login (the login UI only hands back an access token) and for sessions
 * that were created before refresh tokens existed.
 */
export async function startRefreshableSession(
	token: string
): Promise<import('../types/auth').AuthResponse> {
	const response = await postAuth('/token', { headers: { Authorization: `Bearer ${token}` } });

	if (!response.ok) {
		throw new TokenRefreshError('Could not start a refreshable session', response.status);
	}

	return response.json();
}

/**
 * Tells the server to end the session. Best effort: uses keepalive so it still
 * goes out when the page navigates to the login screen right after logout.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
	try {
		await fetch(`${API_URL}/token/revoke`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refreshToken }),
			keepalive: true
		});
	} catch {
		// The token still expires on its own; nothing useful to do offline.
	}
}
