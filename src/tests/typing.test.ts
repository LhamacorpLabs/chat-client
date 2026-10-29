import { describe, it, expect } from 'vitest';
import { TYPING_THROTTLE_MS, activeTypers, pruneTypers, shouldSendTyping } from '$lib/typing';

describe('typing helpers', () => {
	it('lists only unexpired typers', () => {
		expect(activeTypers({ maya: 2000, leo: 500 }, 1000)).toEqual(['maya']);
	});

	it('prunes expired typers', () => {
		expect(pruneTypers({ maya: 2000, leo: 500 }, 1000)).toEqual({ maya: 2000 });
	});

	it('throttles outgoing typing events', () => {
		expect(shouldSendTyping(1000, 1000 + TYPING_THROTTLE_MS - 1)).toBe(false);
		expect(shouldSendTyping(1000, 1000 + TYPING_THROTTLE_MS)).toBe(true);
	});
});
