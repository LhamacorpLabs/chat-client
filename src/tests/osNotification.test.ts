import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	requestNotificationPermission,
	showMessageNotification,
	canShowNotifications,
	getNotificationPermission,
	cleanupAllNotifications
} from '$lib/utils/osNotification';

vi.mock('@tauri-apps/plugin-notification', () => ({
	isPermissionGranted: vi.fn(),
	requestPermission: vi.fn(),
	sendNotification: vi.fn()
}));

function setTauri(enabled: boolean) {
	if (enabled) {
		(window as any).__TAURI_INTERNALS__ = {};
	} else {
		delete (window as any).__TAURI_INTERNALS__;
	}
}

class MockNotification {
	static permission: NotificationPermission = 'granted';
	static requestPermission = vi.fn(() => Promise.resolve(MockNotification.permission));

	title: string;
	body: string;
	onclick: ((ev: Event) => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: ((ev: Event) => void) | null = null;
	close = vi.fn();

	constructor(title: string, options?: NotificationOptions) {
		this.title = title;
		this.body = options?.body || '';
	}
}

describe('osNotification - browser mode', () => {
	beforeEach(() => {
		setTauri(false);
		(globalThis as any).Notification = MockNotification;
		MockNotification.permission = 'granted';
		Object.defineProperty(document, 'hidden', { value: true, configurable: true });
	});

	afterEach(() => {
		cleanupAllNotifications();
		vi.restoreAllMocks();
	});

	it('requestNotificationPermission returns granted when already granted', async () => {
		MockNotification.permission = 'granted';
		const result = await requestNotificationPermission();
		expect(result).toBe('granted');
	});

	it('requestNotificationPermission calls requestPermission when default', async () => {
		MockNotification.permission = 'default';
		MockNotification.requestPermission.mockResolvedValueOnce('granted');
		const result = await requestNotificationPermission();
		expect(MockNotification.requestPermission).toHaveBeenCalled();
		expect(result).toBe('granted');
	});

	it('showMessageNotification creates browser Notification when not in Tauri', async () => {
		const instances: MockNotification[] = [];
		(globalThis as any).Notification = class extends MockNotification {
			constructor(title: string, options?: NotificationOptions) {
				super(title, options);
				instances.push(this);
			}

			static permission = 'granted' as NotificationPermission;
			static requestPermission = MockNotification.requestPermission;
		};

		await showMessageNotification({
			title: 'New message',
			body: 'Hello!',
			chatId: '123'
		});

		expect(instances.length).toBe(1);
		expect(instances[0].title).toBe('New message');
		expect(instances[0].body).toBe('Hello!');
	});

	it('showMessageNotification does nothing when window is focused', async () => {
		Object.defineProperty(document, 'hidden', { value: false, configurable: true });
		vi.spyOn(document, 'hasFocus').mockReturnValue(true);

		const instances: MockNotification[] = [];
		(globalThis as any).Notification = class extends MockNotification {
			constructor(title: string, options?: NotificationOptions) {
				super(title, options);
				instances.push(this);
			}

			static permission = 'granted' as NotificationPermission;
			static requestPermission = MockNotification.requestPermission;
		};

		await showMessageNotification({
			title: 'Test',
			body: 'Body',
			chatId: '456'
		});

		expect(instances.length).toBe(0);
	});

	it('canShowNotifications returns true when permission granted', () => {
		MockNotification.permission = 'granted';
		expect(canShowNotifications()).toBe(true);
	});

	it('canShowNotifications returns false when permission denied', () => {
		MockNotification.permission = 'denied';
		expect(canShowNotifications()).toBe(false);
	});

	it('getNotificationPermission returns current permission', () => {
		MockNotification.permission = 'denied';
		expect(getNotificationPermission()).toBe('denied');
	});
});

describe('osNotification - Tauri mode', () => {
	let tauriMock: {
		isPermissionGranted: ReturnType<typeof vi.fn>;
		requestPermission: ReturnType<typeof vi.fn>;
		sendNotification: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		setTauri(true);
		tauriMock = await import('@tauri-apps/plugin-notification') as any;
		tauriMock.isPermissionGranted.mockReset();
		tauriMock.requestPermission.mockReset();
		tauriMock.sendNotification.mockReset();
		Object.defineProperty(document, 'hidden', { value: true, configurable: true });
	});

	afterEach(() => {
		setTauri(false);
		vi.restoreAllMocks();
	});

	it('requestNotificationPermission uses Tauri plugin when granted', async () => {
		tauriMock.isPermissionGranted.mockResolvedValue(true);
		const result = await requestNotificationPermission();
		expect(result).toBe('granted');
		expect(tauriMock.isPermissionGranted).toHaveBeenCalled();
	});

	it('requestNotificationPermission requests via Tauri when not granted', async () => {
		tauriMock.isPermissionGranted.mockResolvedValue(false);
		tauriMock.requestPermission.mockResolvedValue('granted');
		const result = await requestNotificationPermission();
		expect(result).toBe('granted');
		expect(tauriMock.requestPermission).toHaveBeenCalled();
	});

	it('requestNotificationPermission returns denied when Tauri denies', async () => {
		tauriMock.isPermissionGranted.mockResolvedValue(false);
		tauriMock.requestPermission.mockResolvedValue('denied');
		const result = await requestNotificationPermission();
		expect(result).toBe('denied');
	});

	it('showMessageNotification uses Tauri sendNotification', async () => {
		tauriMock.isPermissionGranted.mockResolvedValue(true);

		await showMessageNotification({
			title: 'Tauri msg',
			body: 'Hello from Tauri',
			chatId: '789'
		});

		expect(tauriMock.sendNotification).toHaveBeenCalledWith({
			title: 'Tauri msg',
			body: 'Hello from Tauri'
		});
	});

	it('showMessageNotification does nothing when Tauri permission denied', async () => {
		tauriMock.isPermissionGranted.mockResolvedValue(false);
		tauriMock.requestPermission.mockResolvedValue('denied');

		await showMessageNotification({
			title: 'Test',
			body: 'Body',
			chatId: '000'
		});

		expect(tauriMock.sendNotification).not.toHaveBeenCalled();
	});

	it('canShowNotifications returns true in Tauri mode', () => {
		expect(canShowNotifications()).toBe(true);
	});

	it('getNotificationPermission returns granted in Tauri mode', () => {
		expect(getNotificationPermission()).toBe('granted');
	});
});
