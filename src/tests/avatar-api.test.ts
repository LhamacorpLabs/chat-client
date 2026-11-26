import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/env/public', () => ({
	PUBLIC_AUTH_API_URL: 'http://auth.test'
}));

import { fetchAvatar } from '$lib/api/auth';

describe('fetchAvatar', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('requests the user avatar with the bearer token and returns the image', async () => {
		fetchMock.mockResolvedValue(new Response('x', { status: 200, headers: { 'Content-Type': 'image/png' } }));

		const blob = await fetchAvatar('tok', 'user/1');

		expect(blob?.type).toBe('image/png');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://auth.test/api/users/user%2F1/avatar');
		expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
	});

	it('returns null when the user has no avatar', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

		expect(await fetchAvatar('tok', 'u1')).toBeNull();
	});

	it('throws on other errors so the caller can retry later', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

		await expect(fetchAvatar('tok', 'u1')).rejects.toThrow('500');
	});

	it('refuses a response that is not an image', async () => {
		fetchMock.mockResolvedValue(
			new Response('<script>', { status: 200, headers: { 'Content-Type': 'text/html' } })
		);

		expect(await fetchAvatar('tok', 'u1')).toBeNull();
	});
});
