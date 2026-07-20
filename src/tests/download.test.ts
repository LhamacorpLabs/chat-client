import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import DownloadPage from '../routes/download/+page.svelte';

const mockAssets = [
	{ name: 'Chat_0.1.0_arm64.dmg', browser_download_url: 'https://github.com/LhamacorpLabs/chat-client/releases/download/v0.1.0/Chat_0.1.0_arm64.dmg' },
	{ name: 'Chat_0.1.0_x64.dmg', browser_download_url: 'https://github.com/LhamacorpLabs/chat-client/releases/download/v0.1.0/Chat_0.1.0_x64.dmg' },
	{ name: 'Chat_0.1.0_x64-setup.exe', browser_download_url: 'https://github.com/LhamacorpLabs/chat-client/releases/download/v0.1.0/Chat_0.1.0_x64-setup.exe' },
	{ name: 'Chat_0.1.0_x64.AppImage', browser_download_url: 'https://github.com/LhamacorpLabs/chat-client/releases/download/v0.1.0/Chat_0.1.0_x64.AppImage' },
	{ name: 'Chat_0.1.0_x64.deb', browser_download_url: 'https://github.com/LhamacorpLabs/chat-client/releases/download/v0.1.0/Chat_0.1.0_x64.deb' }
];

beforeEach(() => {
	vi.restoreAllMocks();
});

describe('Download Page', () => {
	it('shows loading state initially', () => {
		vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
		render(DownloadPage);
		expect(screen.getByText('Loading releases...')).toBeInTheDocument();
	});

	it('renders platform cards after fetching assets', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ assets: mockAssets })
		} as Response);

		render(DownloadPage);

		await waitFor(() => {
			expect(screen.getByText('macOS (Apple Silicon)')).toBeInTheDocument();
			expect(screen.getByText('macOS (Intel)')).toBeInTheDocument();
			expect(screen.getByText('Windows')).toBeInTheDocument();
			expect(screen.getByText('Linux (AppImage)')).toBeInTheDocument();
			expect(screen.getByText('Linux (deb)')).toBeInTheDocument();
		});
	});

	it('links to correct download URLs', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ assets: mockAssets })
		} as Response);

		render(DownloadPage);

		await waitFor(() => {
			const links = screen.getAllByRole('link');
			const downloadLinks = links.filter(l => l.getAttribute('download') !== null);
			expect(downloadLinks).toHaveLength(5);
			expect(downloadLinks[0]).toHaveAttribute('href', mockAssets[0].browser_download_url);
		});
	});

	it('shows error state when fetch fails', async () => {
		vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

		render(DownloadPage);

		await waitFor(() => {
			expect(screen.getByText('Could not load releases.')).toBeInTheDocument();
			expect(screen.getByText('View on GitHub')).toBeInTheDocument();
		});
	});

	it('shows error state on non-ok response', async () => {
		vi.spyOn(global, 'fetch').mockResolvedValue({
			ok: false
		} as Response);

		render(DownloadPage);

		await waitFor(() => {
			expect(screen.getByText('Could not load releases.')).toBeInTheDocument();
		});
	});

	it('renders page title and subtitle', () => {
		vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
		render(DownloadPage);
		expect(screen.getByText('Download Chat')).toBeInTheDocument();
		expect(screen.getByText('Native desktop client with auto-updates')).toBeInTheDocument();
	});

	it('has back link to home', () => {
		vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
		render(DownloadPage);
		const backLink = screen.getByText('← Back to Chat');
		expect(backLink).toHaveAttribute('href', '/');
	});
});
