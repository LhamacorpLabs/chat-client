import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$app/env/public', () => ({
	PUBLIC_AUTH_API_URL: 'http://auth.test'
}));

import { fetchAvatar, uploadAvatar, removeAvatar } from '$lib/api/auth';

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

describe('uploadAvatar and removeAvatar', () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uploads the file as multipart without forcing a content type', async () => {
		fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
		const file = new File(['x'], 'me.png', { type: 'image/png' });

		await uploadAvatar('tok', file);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://auth.test/api/users/current/avatar');
		expect(init.method).toBe('PUT');
		expect(init.headers).toEqual({ Authorization: 'Bearer tok' });
		expect((init.body as FormData).get('file')).toBeInstanceOf(File);
	});

	it('removes the avatar with DELETE', async () => {
		fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

		await removeAvatar('tok');

		expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
	});

	it('surfaces the server message for a rejected image', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ message: 'Unsupported image. Use a JPEG, PNG or GIF file' }), { status: 400 })
		);

		await expect(uploadAvatar('tok', new File(['x'], 'a.png'))).rejects.toThrow('Unsupported image');
	});

	it('explains an oversized upload', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 413 }));

		await expect(uploadAvatar('tok', new File(['x'], 'a.png'))).rejects.toThrow('maximum 1 MB');
	});

	it('falls back to a generic message and reports network failures', async () => {
		fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
		await expect(removeAvatar('tok')).rejects.toThrow('Could not update your profile picture.');

		fetchMock.mockRejectedValueOnce(new TypeError('failed'));
		await expect(removeAvatar('tok')).rejects.toThrow('Could not reach the server');
	});
});
