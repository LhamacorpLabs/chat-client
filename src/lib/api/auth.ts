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

export async function register(credentials: AuthRequest): Promise<AuthResponse> {
	const requestBody: any = {
		username: credentials.username,
		password: credentials.password
	};

	if (credentials.email && credentials.email.trim()) {
		requestBody.email = credentials.email.trim();
	}

	const response = await fetch(`${API_URL}/register`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		throw new Error('Registration failed');
	}

	return response.json();
}

export async function refreshToken(token: string): Promise<AuthResponse> {
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