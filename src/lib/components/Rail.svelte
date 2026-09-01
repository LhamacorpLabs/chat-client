<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import type { Chat } from '$lib/types/chat';

	interface Props {
		chats: Chat[];
		activeChatId?: string;
		unreadMap?: Record<string, boolean>;
		listOpen: boolean;
		onToggleList: () => void;
		onSelectChat: (id: string) => void;
	}

	let { chats, activeChatId, unreadMap = {}, listOpen, onToggleList, onSelectChat }: Props = $props();

	const initial = $derived(($authStore.user?.username ?? '?').charAt(0).toUpperCase());

	// Deterministic-but-varied avatar color per chat, so the icon-only
	// stack reads as distinct destinations rather than a wall of
	// identical circles - same idea as Slack/Discord's per-channel color.
	const PALETTE = ['#ff6fa8', '#7c6fee', '#4fd6d0', '#f0b429', '#7fd8a8', '#6fa8ff'];
	function colorFor(id: string): string {
		let hash = 0;
		for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
		return PALETTE[hash % PALETTE.length];
	}
</script>

<nav class="rail" aria-label="Primary">
	<div class="rail-mark">
		<img src="/logo.png" alt="" />
	</div>

	<button
		class="rail-btn list-toggle"
		class:active={listOpen}
		type="button"
		onclick={onToggleList}
		title={listOpen ? 'Hide chat list' : 'Show chat list'}
		aria-expanded={listOpen}
	>
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
		</svg>
	</button>

	<div class="chat-stack">
		{#each chats as chat (chat.id)}
			<button
				class="chat-avatar"
				class:active={chat.id === activeChatId}
				type="button"
				onclick={() => onSelectChat(chat.id)}
				title={`#${chat.name}`}
				style={`background: ${colorFor(chat.id)}`}
			>
				{chat.name.charAt(0).toUpperCase()}
				{#if unreadMap[chat.id]}
					<span class="unread-dot" aria-label="Unread messages"></span>
				{/if}
			</button>
		{/each}
	</div>

	<button class="rail-btn" type="button" disabled aria-disabled="true" title="Contacts (coming soon)">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="8.5" r="3.2" stroke="currentColor" stroke-width="1.7" />
			<path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
		</svg>
	</button>

	<button class="rail-btn" type="button" disabled aria-disabled="true" title="Notifications (coming soon)">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M6 10a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linejoin="round"
			/>
			<path d="M9.5 18.5a2.5 2.5 0 005 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
		</svg>
	</button>

	<button class="rail-btn" type="button" disabled aria-disabled="true" title="Settings (coming soon)">
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" />
			<path
				d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
				stroke="currentColor"
				stroke-width="1.3"
				stroke-linejoin="round"
			/>
		</svg>
	</button>

	<div class="rail-avatar" title={$authStore.user?.username ?? ''} aria-hidden="true">{initial}</div>
</nav>

<style>
	.rail {
		width: var(--rail-width, 56px);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--rail-icon-gap, 4px);
		padding: 12px 0;
		background: var(--rail-bg, #000);
		border-radius: var(--radius-lg);
	}

	.rail-mark {
		width: 30px;
		height: 30px;
		border-radius: 9px;
		overflow: hidden;
		margin-bottom: 4px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-subtle, rgba(255, 255, 255, 0.08));
	}

	.rail-mark img {
		width: 20px;
		height: 20px;
		object-fit: contain;
	}

	.rail-btn {
		width: var(--rail-icon-size, 36px);
		height: var(--rail-icon-size, 36px);
		border-radius: var(--rail-icon-radius, 999px);
		border: none;
		background: transparent;
		color: var(--rail-icon-color, var(--text-secondary));
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		text-decoration: none;
		transition: background var(--duration-base, 0.15s) var(--ease-standard, ease),
			color var(--duration-base, 0.15s) var(--ease-standard, ease);
	}

	.rail-btn svg {
		width: 16px;
		height: 16px;
	}

	.rail-btn:hover:not(:disabled) {
		background: var(--rail-icon-bg-hover, rgba(255, 255, 255, 0.08));
		color: var(--text-primary);
	}

	.rail-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.rail-btn.active {
		background: var(--rail-icon-bg-active, #fff);
		color: var(--rail-icon-color-active, #000);
	}

	.chat-stack {
		width: 100%;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 4px 0;
		scrollbar-width: none;
	}

	.chat-stack::-webkit-scrollbar {
		display: none;
	}

	.chat-avatar {
		position: relative;
		width: var(--rail-icon-size, 36px);
		height: var(--rail-icon-size, 36px);
		flex-shrink: 0;
		border: none;
		border-radius: 10px;
		color: #fff;
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity var(--duration-base, 0.15s) var(--ease-standard, ease),
			border-radius var(--duration-base, 0.15s) var(--ease-standard, ease);
	}

	.chat-avatar:hover {
		opacity: 0.85;
	}

	.chat-avatar.active {
		opacity: 1;
		border-radius: 999px;
		box-shadow: 0 0 0 2px var(--rail-bg, #000), 0 0 0 4px var(--rail-icon-bg-active, #fff);
	}

	.unread-dot {
		position: absolute;
		top: -2px;
		right: -2px;
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: var(--accent, #7c6fee);
		border: 2px solid var(--rail-bg, #000);
	}

	.rail-avatar {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--accent-contrast, #fff);
		background: var(--accent, #7c6fee);
		margin-top: 4px;
	}
</style>
