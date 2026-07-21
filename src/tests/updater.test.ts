import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	updateReady,
	startUpdateChecker,
	stopUpdateChecker,
	restartApp
} from '$lib/utils/updater';

function mockElectronAPI() {
	const check = vi.fn().mockResolvedValue(true);
	const quitAndInstall = vi.fn().mockResolvedValue(undefined);
	let readyCallback: (() => void) | null = null;

	(window as any).electronAPI = {
		isElectron: true,
		updater: {
			check,
			quitAndInstall,
			onReady: vi.fn((cb: () => void) => {
				readyCallback = cb;
			})
		}
	};

	return {
		check,
		quitAndInstall,
		fireReady: () => readyCallback?.()
	};
}

describe('updater', () => {
	beforeEach(() => {
		updateReady.set(false);
	});

	afterEach(() => {
		stopUpdateChecker();
		delete (window as any).electronAPI;
		vi.restoreAllMocks();
	});

	it('does nothing when electronAPI is unavailable', async () => {
		delete (window as any).electronAPI;
		expect(() => startUpdateChecker()).not.toThrow();
		await expect(restartApp()).resolves.toBeUndefined();
	});

	it('checks for updates on start and sets updateReady when the main process reports one downloaded', async () => {
		const api = mockElectronAPI();
		startUpdateChecker();

		await vi.waitFor(() => expect(api.check).toHaveBeenCalledTimes(1));
		expect(updateReady).toHaveProperty('subscribe');

		let ready = false;
		const unsubscribe = updateReady.subscribe((v) => (ready = v));
		expect(ready).toBe(false);

		api.fireReady();
		expect(ready).toBe(true);
		unsubscribe();
	});

	it('restartApp asks the main process to quit and install the update', async () => {
		const api = mockElectronAPI();
		await restartApp();
		expect(api.quitAndInstall).toHaveBeenCalledTimes(1);
	});
});
