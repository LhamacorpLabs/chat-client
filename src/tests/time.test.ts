import { describe, it, expect } from 'vitest';
import { formatRelativeShort, formatDayLabel, isSameDay } from '$lib/utils/time';

const now = new Date(2026, 8, 24, 15, 0, 0);
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);

describe('formatRelativeShort', () => {
	it('shows "now" under a minute', () => {
		expect(formatRelativeShort(minutesAgo(0.5), now)).toBe('now');
	});

	it('shows minutes under an hour', () => {
		expect(formatRelativeShort(minutesAgo(12), now)).toBe('12m');
	});

	it('shows hours earlier the same day', () => {
		expect(formatRelativeShort(minutesAgo(180), now)).toBe('3h');
	});

	it('shows "Yesterday" for the previous calendar day', () => {
		expect(formatRelativeShort(new Date(2026, 8, 23, 23, 30), now)).toBe('Yesterday');
	});

	it('uses a date for anything older than a week', () => {
		const label = formatRelativeShort(new Date(2026, 5, 2), now);
		expect(label).not.toBe('Yesterday');
		expect(label).toMatch(/2/);
	});
});

describe('formatDayLabel', () => {
	it('labels today and yesterday', () => {
		expect(formatDayLabel(minutesAgo(10), now)).toBe('Today');
		expect(formatDayLabel(new Date(2026, 8, 23, 9), now)).toBe('Yesterday');
	});
});

describe('isSameDay', () => {
	it('compares calendar days, not 24h windows', () => {
		expect(isSameDay(new Date(2026, 8, 24, 0, 1), new Date(2026, 8, 24, 23, 59))).toBe(true);
		expect(isSameDay(new Date(2026, 8, 23, 23, 59), new Date(2026, 8, 24, 0, 1))).toBe(false);
	});
});
