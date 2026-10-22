import { installFetchLogger } from '$lib/stores/debugLog';

// This is a Single Page Application (SPA)
// Disable server-side rendering and enable client-side routing
export const ssr = false;

// Only prerender the static pages, not dynamic routes
export const prerender = false;

// Installed before any load function runs so the debug panel sees every request.
installFetchLogger();
