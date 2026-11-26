import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get, writable } from 'svelte/store';

const { authStore, fetchAvatar } = vi.hoisted(() => ({
	authStore: { current: null as unknown },
	fetchAvatar: vi.fn()
}));

vi.mock('$lib/stores/auth', async () => {
	const { writable } = await import('svelte/store');
	const store = writable({ user: null, token: 'token-1', isLoading: false, error: null });
	authStore.current = store;
	return { authStore: store };
});

vi.mock('$lib/api/auth', () => ({ fetchAvatar }));

import { avatars, ensureAvatar } from '$lib/stores/avatars';

const auth = () => authStore.current as ReturnType<typeof writable<{ token: string | null }>>;

function signIn() {
	auth().set({ token: 'token-1' });
}

function signOut() {
	auth().set({ token: null });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('avatars store', () => {
	let created: string[];
	let revoked: string[];

	beforeEach(() => {
		signOut();
		signIn();
		fetchAvatar.mockReset();
		created = [];
		revoked = [];
		let n = 0;
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => {
				const url = `blob:avatar-${++n}`;
				created.push(url);
				return url;
			}),
			revokeObjectURL: vi.fn((url: string) => revoked.push(url))
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('fetches an avatar once however many components ask for it', async () => {
		fetchAvatar.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));

		ensureAvatar('u1');
		ensureAvatar('u1');
		ensureAvatar('u1');
		await flush();

		expect(fetchAvatar).toHaveBeenCalledTimes(1);
		expect(fetchAvatar).toHaveBeenCalledWith('token-1', 'u1');
		expect(get(avatars).u1).toBe('blob:avatar-1');
	});

	it('remembers that a user has no avatar instead of asking again', async () => {
		fetchAvatar.mockResolvedValue(null);

		ensureAvatar('u1');
		await flush();
		ensureAvatar('u1');
		await flush();

		expect(fetchAvatar).toHaveBeenCalledTimes(1);
		expect(get(avatars).u1).toBeNull();
	});

	it('does nothing without a user id or a session', async () => {
		ensureAvatar(null);
		ensureAvatar(undefined);
		signOut();
		ensureAvatar('u1');
		await flush();

		expect(fetchAvatar).not.toHaveBeenCalled();
	});

	it('retries a failed request, but not immediately', async () => {
		vi.useFakeTimers();
		fetchAvatar.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(new Blob(['x'], { type: 'image/png' }));

		ensureAvatar('u1');
		await vi.advanceTimersByTimeAsync(0);
		ensureAvatar('u1');
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchAvatar).toHaveBeenCalledTimes(1);
		expect(get(avatars).u1).toBeUndefined();

		await vi.advanceTimersByTimeAsync(61_000);
		ensureAvatar('u1');
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchAvatar).toHaveBeenCalledTimes(2);
		expect(get(avatars).u1).toBe('blob:avatar-1');
	});

	it('revalidates after ten minutes and releases the previous picture', async () => {
		vi.useFakeTimers();
		fetchAvatar.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));

		ensureAvatar('u1');
		await vi.advanceTimersByTimeAsync(0);
		await vi.advanceTimersByTimeAsync(5 * 60_000);
		ensureAvatar('u1');
		await vi.advanceTimersByTimeAsync(0);
		expect(fetchAvatar).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(6 * 60_000);
		ensureAvatar('u1');
		await vi.advanceTimersByTimeAsync(0);

		expect(fetchAvatar).toHaveBeenCalledTimes(2);
		expect(revoked).toEqual(['blob:avatar-1']);
		expect(get(avatars).u1).toBe('blob:avatar-2');
	});

	it('drops everything and releases the pictures on sign-out', async () => {
		fetchAvatar.mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
		ensureAvatar('u1');
		await flush();

		signOut();

		expect(get(avatars)).toEqual({});
		expect(revoked).toEqual(['blob:avatar-1']);
	});

	it('ignores a response that arrives after sign-out', async () => {
		let resolve!: (blob: Blob) => void;
		fetchAvatar.mockReturnValue(new Promise<Blob>((r) => (resolve = r)));

		ensureAvatar('u1');
		signOut();
		resolve(new Blob(['x'], { type: 'image/png' }));
		await flush();

		expect(get(avatars)).toEqual({});
		expect(created).toEqual([]);
	});
});
