import type { AuthRequest, AuthResponse } from '../types/auth';
import { PUBLIC_AUTH_API_URL } from '$env/static/public';

const API_URL = `${PUBLIC_AUTH_API_URL || 'https://auth.lhamacorp.com'}/api`;

export async function login(credentials: AuthRequest): Promise<AuthResponse> {
	const response = await fetch(`${API_URL}/authenticate`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(credentials)
	});

	if (!response.ok) {
		throw new Error('Login failed');
	}

	return response.json();
}