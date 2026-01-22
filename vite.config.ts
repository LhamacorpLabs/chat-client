import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// Get git commit ID at build time
function getGitCommitId(): string {
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
