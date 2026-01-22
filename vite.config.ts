import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Get git commit ID at build time
function getGitCommitId(): string {
	// First, try to use environment variable (set in Docker build)
	if (process.env.GIT_COMMIT_ID && process.env.GIT_COMMIT_ID !== 'unknown') {
		return process.env.GIT_COMMIT_ID;
	}

	// Fallback to git command (for local development)
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch (error) {
		console.warn('Could not get git commit ID:', error);
		return 'unknown';
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__GIT_COMMIT_ID__: JSON.stringify(getGitCommitId())
	}
});
