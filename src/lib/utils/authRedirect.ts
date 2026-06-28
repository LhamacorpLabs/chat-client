import { PUBLIC_AUTH_UI_URL } from '$env/static/public';

export function getLoginUrl(): string {
	const callbackUrl = `${window.location.origin}/auth/callback`;
	return `${PUBLIC_AUTH_UI_URL}?redirect=${encodeURIComponent(callbackUrl)}`;
}

export function redirectToLogin(): void {
	window.location.href = getLoginUrl();
}
