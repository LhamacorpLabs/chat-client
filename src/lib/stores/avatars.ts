import { writable, get } from 'svelte/store';
import { authStore } from './auth';
import { fetchAvatar } from '../api/auth';

interface Entry {
	url: string | null;
	checkedAt: number;
}

const REVALIDATE_MS = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;

export const avatars = writable<Record<string, string | null>>({});

const entries = new Map<string, Entry>();
const inflight = new Set<string>();
const failedAt = new Map<string, number>();
let generation = 0;

function reset() {
	generation++;
	for (const entry of entries.values()) {
		if (entry.url) URL.revokeObjectURL(entry.url);
	}
	entries.clear();
	inflight.clear();
	failedAt.clear();
	avatars.set({});
}

authStore.subscribe((state) => {
	if (!state.token) reset();
});

async function load(userId: string, token: string) {
	const started = generation;
	inflight.add(userId);

	try {
		const blob = await fetchAvatar(token, userId);
		if (started !== generation) return;

		const previous = entries.get(userId);
		if (previous?.url) URL.revokeObjectURL(previous.url);

		const url = blob ? URL.createObjectURL(blob) : null;
		entries.set(userId, { url, checkedAt: Date.now() });
		failedAt.delete(userId);
		avatars.update((state) => ({ ...state, [userId]: url }));
	} catch {
		if (started === generation) failedAt.set(userId, Date.now());
	} finally {
		if (started === generation) inflight.delete(userId);
	}
}

export function ensureAvatar(userId: string | null | undefined): void {
	if (!userId || inflight.has(userId)) return;

	const token = get(authStore).token;
	if (!token) return;

	const now = Date.now();
	const entry = entries.get(userId);
	if (entry && now - entry.checkedAt < REVALIDATE_MS) return;

	const failed = failedAt.get(userId);
	if (failed !== undefined && now - failed < RETRY_MS) return;

	void load(userId, token);
}
