import { PUBLIC_AUTH_API_URL } from '$env/static/public';

const API_URL = `${PUBLIC_AUTH_API_URL || 'https://auth.lhamacorp.com'}/api`;

export async function refreshToken(token: string): Promise<import('../types/auth').AuthResponse> {
	const response = await fetch(`${API_URL}/refresh`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error('Token refresh failed');
	}

	return response.json();
}
