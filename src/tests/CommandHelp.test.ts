import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CommandHelp from '$lib/components/CommandHelp.svelte';

describe('CommandHelp', () => {
	const entries = [
		{ usage: '/help', description: 'List the available commands' },
		{ usage: '/mute [on|off]', description: 'Mute or unmute this chat' }
	];

	it('shows each command with its description, and the argument hint separately', () => {
		render(CommandHelp, { entries, onClose: vi.fn() });

		expect(screen.getByRole('dialog', { name: 'Commands' })).toBeTruthy();
		expect(screen.getByText('List the available commands')).toBeTruthy();
		expect(screen.getByText('/mute').textContent).toBe('/mute');
		expect(screen.getByText('[on|off]')).toBeTruthy();
	});

	it('closes with Escape', async () => {
		const onClose = vi.fn();
		render(CommandHelp, { entries, onClose });

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalled();
	});
});
