// Shared date/time formatting for the chat list and message thread.
// All functions take an optional `now` so they're deterministic in tests.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysBetween(a: Date, b: Date): number {
	return Math.round((startOfDay(b) - startOfDay(a)) / (24 * HOUR));
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
	return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** Clock time only, e.g. "14:05" / "2:05 PM" depending on locale. */
export function formatTime(value: string | Date): string {
	return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Full date + time for tooltips. */
export function formatFullDateTime(value: string | Date): string {
	return new Date(value).toLocaleString([], {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/** Compact activity label for list rows: "now", "5m", "3h", "Yesterday", "Mon", "Sep 3". */
export function formatRelativeShort(value: string | Date, now: Date = new Date()): string {
	const date = new Date(value);
	const diff = now.getTime() - date.getTime();

	if (diff < MINUTE) return 'now';
	if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;

	const days = daysBetween(date, now);
	if (days === 0) return `${Math.floor(diff / HOUR)}h`;
	if (days === 1) return 'Yesterday';
	if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
	if (date.getFullYear() === now.getFullYear()) {
		return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}
	return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Day divider label for the message thread: "Today", "Yesterday", "Monday, September 22". */
export function formatDayLabel(value: string | Date, now: Date = new Date()): string {
	const date = new Date(value);
	const days = daysBetween(date, now);

	if (days === 0) return 'Today';
	if (days === 1) return 'Yesterday';
	return date.toLocaleDateString([], {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
	});
}
