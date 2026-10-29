export const TYPING_TTL_MS = 4000;
export const TYPING_THROTTLE_MS = 2500;

export type TypingExpiries = Record<string, number>;

export function activeTypers(expiries: TypingExpiries, now: number): string[] {
	return Object.entries(expiries)
		.filter(([, expiresAt]) => expiresAt > now)
		.map(([username]) => username);
}

export function pruneTypers(expiries: TypingExpiries, now: number): TypingExpiries {
	return Object.fromEntries(Object.entries(expiries).filter(([, expiresAt]) => expiresAt > now));
}

export function shouldSendTyping(lastSentAt: number, now: number): boolean {
	return now - lastSentAt >= TYPING_THROTTLE_MS;
}
