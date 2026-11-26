import { get } from 'svelte/store';
import { chatMuteStore } from '$lib/stores/chatMute';
import { debugEnabled, setDebugEnabled } from '$lib/stores/debugLog';
import { THEME_OPTIONS, setTheme } from '$lib/stores/theme';
import { checkForUpdate, updateReady } from '$lib/utils/updater';

export interface CommandContext {
	/** The chat the command was typed in. */
	chatId?: string;
	/** Injectable so tests don't reload the page. */
	reload?: () => void;
}

export interface Command {
	name: string;
	/** Shown by /help, e.g. "/theme [name]". */
	usage: string;
	description: string;
	/** Takes an optional on|off argument; bare use toggles. Any other argument means it is not a command. */
	toggle?: boolean;
	run: (args: string[], context: CommandContext) => string | Promise<string>;
}

const MEMBER_COLORS_KEY = 'member_colors';

function normalize(value: string): string {
	return value.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const commands: Command[] = [
	{
		name: 'help',
		usage: '/help',
		description: 'List the available commands',
		run: () =>
			commands
				.filter(command => command.name !== 'debug' || get(debugEnabled))
				.map(command => `${command.usage} - ${command.description}`)
				.join('\n')
	},
	{
		name: 'version',
		usage: '/version',
		description: 'Show the app version',
		run: () => `Lhama Chat ${__APP_VERSION__} (${window.electronAPI ? 'desktop app' : 'web'})`
	},
	{
		name: 'update',
		usage: '/update',
		description: 'Check for a new desktop app version',
		run: async () => {
			if (!window.electronAPI) return 'Updates are only available in the desktop app.';
			if (get(updateReady)) return 'An update is ready. Restart the app to install it.';
			const ok = await checkForUpdate();
			if (!ok) return 'The update check failed. Try again in a moment.';
			return get(updateReady)
				? 'An update is ready. Restart the app to install it.'
				: 'Checked for updates. If one is available it downloads in the background and a restart prompt appears.';
		}
	},
	{
		name: 'mute',
		usage: '/mute [on|off]',
		description: 'Mute or unmute notifications for this chat (no argument toggles)',
		toggle: true,
		run: ([state], { chatId }) => {
			if (!chatId) return 'Open a chat first.';
			const muted = state === 'on' ? true : state === 'off' ? false : !get(chatMuteStore).mutedChats[chatId];
			if (muted) chatMuteStore.muteChat(chatId);
			else chatMuteStore.unmuteChat(chatId);
			return muted ? 'Chat muted.' : 'Chat unmuted.';
		}
	},
	{
		name: 'theme',
		usage: '/theme [name]',
		description: 'Switch theme, or list the themes',
		run: args => {
			const name = args.join(' ');
			if (!name) return `Themes: ${THEME_OPTIONS.map(option => option.id).join(', ')}`;
			const wanted = normalize(name);
			const option = THEME_OPTIONS.find(
				candidate => normalize(candidate.id) === wanted || normalize(candidate.label) === wanted
			);
			if (!option) return `Unknown theme "${name}". Themes: ${THEME_OPTIONS.map(o => o.id).join(', ')}`;
			setTheme(option.id);
			return `Theme set to ${option.label}.`;
		}
	},
	{
		name: 'clear-cache',
		usage: '/clear-cache',
		description: 'Clear cached display data and reload (stays signed in)',
		run: (_args, { reload = () => window.location.reload() }) => {
			// Only derived display data: sign-in, mute and notification state are left alone.
			localStorage.removeItem(MEMBER_COLORS_KEY);
			setTimeout(reload, 600);
			return 'Cache cleared. Reloading…';
		}
	},
	{
		name: 'debug',
		usage: '/debug [on|off]',
		description: 'Turn debug mode on or off (no argument toggles)',
		toggle: true,
		run: ([state]) => {
			const enable = state === 'on' ? true : state === 'off' ? false : !get(debugEnabled);
			setDebugEnabled(enable);
			return enable
				? 'Debug mode on. Open the debug panel from the menu or with Ctrl/⌘+Shift+D. Send /debug off to turn it off.'
				: 'Debug mode off.';
		}
	}
];

/**
 * Runs `text` if it is a known slash command and returns the reply to show,
 * or null when it is ordinary text (including unknown /words), so it is sent as a message.
 */
export async function runCommand(text: string, context: CommandContext = {}): Promise<string | null> {
	const match = text.trim().match(/^\/([a-z][a-z-]*)(?:\s+(.*))?$/i);
	if (!match) return null;

	const command = commands.find(candidate => candidate.name === match[1].toLowerCase());
	if (!command) return null;

	const args = (match[2] ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (command.toggle && args.length > 0 && (args.length > 1 || (args[0] !== 'on' && args[0] !== 'off'))) return null;

	return command.run(args, context);
}
