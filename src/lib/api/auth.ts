import { PUBLIC_AUTH_API_URL } from '$env/static/public';

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
	} catch (networkError) {
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
