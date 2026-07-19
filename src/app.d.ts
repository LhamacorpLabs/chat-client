// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Vite injected variables
	const __APP_VERSION__: string;

	interface Window {
		electronAPI?: {
			isElectron: true;
			openExternal: (url: string) => Promise<void>;
			store: {
				get: <T = unknown>(key: string) => Promise<T | undefined>;
				set: (key: string, value: unknown) => Promise<void>;
				delete: (key: string) => Promise<void>;
			};
			badge: {
				set: (count: number) => Promise<void>;
			};
			updater: {
				check: () => Promise<boolean>;
				quitAndInstall: () => Promise<void>;
				onReady: (callback: () => void) => void;
			};
		};
	}
}

export {};
