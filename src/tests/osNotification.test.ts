import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	requestNotificationPermission,
	showMessageNotification,
	canShowNotifications,
	getNotificationPermission,
	cleanupAllNotifications
} from '$lib/utils/osNotification';

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

describe('osNotification', () => {
	beforeEach(() => {
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

	it('showMessageNotification creates a Notification when the window is hidden', async () => {
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

	it('showMessageNotification does nothing when permission denied', async () => {
		MockNotification.permission = 'denied';

		const instances: MockNotification[] = [];
		(globalThis as any).Notification = class extends MockNotification {
			constructor(title: string, options?: NotificationOptions) {
				super(title, options);
				instances.push(this);
			}

			static permission = 'denied' as NotificationPermission;
			static requestPermission = MockNotification.requestPermission;
		};

		await showMessageNotification({
			title: 'Test',
			body: 'Body',
			chatId: '000'
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
