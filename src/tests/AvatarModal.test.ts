import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

const { uploadAvatar, removeAvatar, refreshAvatar, getValidToken, avatarStore } = vi.hoisted(() => ({
	uploadAvatar: vi.fn(),
	removeAvatar: vi.fn(),
	refreshAvatar: vi.fn(),
	getValidToken: vi.fn(),
	avatarStore: { current: null as null | { set: (value: Record<string, string | null>) => void } }
}));

vi.mock('$lib/stores/auth', async () => {
	const { writable } = await import('svelte/store');
	return {
		authStore: writable({ user: { id: 'u1', username: 'demo' }, token: 'tok' }),
		getValidToken
	};
});

vi.mock('$lib/stores/avatars', async () => {
	const { writable } = await import('svelte/store');
	const store = writable<Record<string, string | null>>({});
	avatarStore.current = store;
	return { avatars: store, ensureAvatar: vi.fn(), refreshAvatar };
});

vi.mock('$lib/api/auth', () => ({ uploadAvatar, removeAvatar }));

import AvatarModal from '$lib/components/AvatarModal.svelte';

const setAvatars = (value: Record<string, string | null>) => avatarStore.current?.set(value);

function pick(file: File) {
	const input = document.querySelector('input[type="file"]') as HTMLInputElement;
	Object.defineProperty(input, 'files', { value: [file], configurable: true });
	return fireEvent.change(input);
}

describe('AvatarModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		getValidToken.mockResolvedValue('tok');
		setAvatars({});
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
	});

	it('cannot save until an image is chosen', () => {
		render(AvatarModal, { onClose: vi.fn() });

		expect((screen.getByRole('button', { name: 'Save picture' }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.queryByRole('button', { name: 'Remove picture' })).toBeNull();
	});

	it('rejects files that are not JPEG, PNG or GIF', async () => {
		render(AvatarModal, { onClose: vi.fn() });

		await pick(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }));

		expect(screen.getByRole('alert').textContent).toContain('JPEG, PNG or GIF');
		expect((screen.getByRole('button', { name: 'Save picture' }) as HTMLButtonElement).disabled).toBe(true);
	});

	it('rejects files over 1 MB', async () => {
		render(AvatarModal, { onClose: vi.fn() });

		await pick(new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' }));

		expect(screen.getByRole('alert').textContent).toContain('1 MB');
	});

	it('uploads the chosen image, refreshes the avatar and closes', async () => {
		uploadAvatar.mockResolvedValue(undefined);
		const onClose = vi.fn();
		render(AvatarModal, { onClose });
		const file = new File(['x'], 'me.png', { type: 'image/png' });

		await pick(file);
		await fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(uploadAvatar).toHaveBeenCalledWith('tok', file);
		expect(refreshAvatar).toHaveBeenCalledWith('u1');
	});

	it('shows the server error and stays open when the upload fails', async () => {
		uploadAvatar.mockRejectedValue(new Error('Unsupported image. Use a JPEG, PNG or GIF file'));
		const onClose = vi.fn();
		render(AvatarModal, { onClose });

		await pick(new File(['x'], 'me.png', { type: 'image/png' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));

		await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Unsupported image'));
		expect(onClose).not.toHaveBeenCalled();
		expect(refreshAvatar).not.toHaveBeenCalled();
	});

	it('offers to remove an existing picture', async () => {
		setAvatars({ u1: 'blob:current' });
		removeAvatar.mockResolvedValue(undefined);
		const onClose = vi.fn();
		render(AvatarModal, { onClose });

		await fireEvent.click(await screen.findByRole('button', { name: 'Remove picture' }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(removeAvatar).toHaveBeenCalledWith('tok');
		expect(refreshAvatar).toHaveBeenCalledWith('u1');
	});

	it('reports an expired session instead of calling the API', async () => {
		getValidToken.mockResolvedValue(null);
		render(AvatarModal, { onClose: vi.fn() });

		await pick(new File(['x'], 'me.png', { type: 'image/png' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save picture' }));

		await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('session has expired'));
		expect(uploadAvatar).not.toHaveBeenCalled();
	});
});
