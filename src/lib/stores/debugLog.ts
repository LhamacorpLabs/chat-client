import { writable } from 'svelte/store';

export type DebugEntryKind = 'http' | 'auth' | 'mqtt';

export interface DebugEntry {
	id: number;
	time: number;
	kind: DebugEntryKind;
	// 'GET', 'POST', ... for http; the event name ('refresh', 'connect', ...) otherwise
	label: string;
	detail: string;
	status?: number;
	durationMs?: number;
	error?: string;
	pending?: boolean;
	// Where the entry was triggered from, to tell which code is behind a request
	stack?: string;
}

const MAX_ENTRIES = 200;
const STACK_FRAMES = 8;

// Values of these query parameters are credentials and never end up in the log.
const SECRET_PARAMS = /^(token|access_token|refresh_token|id_token|code|password|secret)$/i;

export const debugLog = writable<DebugEntry[]>([]);
export const debugPanelOpen = writable(false);

let nextId = 1;

function captureStack(): string | undefined {
	const stack = new Error().stack;
	if (!stack) return undefined;

	return stack
		.split('\n')
		.slice(1)
		.filter(line => !line.includes('debugLog'))
		.slice(0, STACK_FRAMES)
		.map(line => line.trim())
		.join('\n');
}

export function maskUrl(url: string): string {
	try {
		const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
		for (const key of [...parsed.searchParams.keys()]) {
			if (SECRET_PARAMS.test(key)) parsed.searchParams.set(key, '***');
		}
		return parsed.toString();
	} catch {
		return url;
	}
}

function addEntry(entry: Omit<DebugEntry, 'id' | 'time'>): number {
	const id = nextId++;
	debugLog.update(entries => {
		const next = [...entries, { ...entry, id, time: Date.now() }];
		return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
	});
	return id;
}

function updateEntry(id: number, changes: Partial<DebugEntry>) {
	debugLog.update(entries => entries.map(entry => (entry.id === id ? { ...entry, ...changes } : entry)));
}

/** Records a non-HTTP event (token refresh, MQTT connect, ...). Never pass credentials in `detail`. */
export function logDebugEvent(kind: Exclude<DebugEntryKind, 'http'>, label: string, detail = '', error?: string) {
	addEntry({ kind, label, detail, error, stack: captureStack() });
}

export function clearDebugLog() {
	debugLog.set([]);
}

let fetchLoggerInstalled = false;

/** Wraps window.fetch so every request shows up in the debug panel. Headers and bodies are not recorded. */
export function installFetchLogger() {
	if (fetchLoggerInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
	fetchLoggerInstalled = true;

	const originalFetch = window.fetch.bind(window);

	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
		const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
		const started = performance.now();
		const id = addEntry({ kind: 'http', label: method, detail: maskUrl(url), pending: true, stack: captureStack() });

		try {
			const response = await originalFetch(input, init);
			updateEntry(id, {
				pending: false,
				status: response.status,
				durationMs: Math.round(performance.now() - started)
			});
			return response;
		} catch (error) {
			updateEntry(id, {
				pending: false,
				durationMs: Math.round(performance.now() - started),
				error: error instanceof Error ? error.message : String(error)
			});
			throw error;
		}
	};
}
