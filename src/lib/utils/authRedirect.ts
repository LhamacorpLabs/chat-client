import { PUBLIC_AUTH_UI_URL } from '$env/static/public';

function getOrigin(): string {
	if (typeof window !== 'undefined' && window.electronAPI) {
		return 'https://chat.lhamacorp.com';
	}
	return window.location.origin;
}

export function getLoginUrl(): string {
	const callbackUrl = `${getOrigin()}/auth/callback`;
	return `${PUBLIC_AUTH_UI_URL}?redirect=${encodeURIComponent(callbackUrl)}`;
}

export function redirectToLogin(): void {
	window.location.href = getLoginUrl();
}
