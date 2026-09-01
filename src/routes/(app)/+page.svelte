<!-- Shown in the main column when no chat is open (desktop only - on
     mobile the sidebar is the whole screen while on this route, so this
     panel never actually becomes visible there).

     While there's an incomplete onboarding step, this is a real "Get
     Started" checklist (not the reference mockup's placeholder model
     cards, which don't map to anything here) - each step reflects
     actual app state, not a canned/always-done demo. Once every step
     is done it steps aside for the plain "select a chat" placeholder,
     same as before this existed. -->
<script lang="ts">
	import { chatStore } from '$lib/stores/chat';

	let isElectron = $state(typeof window !== 'undefined' && !!window.electronAPI);

	let hasChats = $derived($chatStore.chats.length > 0);
	let hasInvited = $derived($chatStore.chats.some(chat => chat.members.length > 1));

	let steps = $derived([
		{
			label: 'Create your first chat',
			hint: 'Tap the + next to "Chat" in the sidebar',
			done: hasChats
		},
		{
			label: 'Invite a teammate',
			hint: 'Open a chat and tap "+ Invite"',
			done: hasInvited
		},
		{
			label: 'Get the desktop app',
			hint: null,
			href: isElectron ? null : '/download',
			done: isElectron
		}
	]);

	let activeIndex = $derived(steps.findIndex(step => !step.done));
</script>

{#if activeIndex !== -1}
	<div class="onboarding-panel">
		<div class="onboarding-card">
			<div class="eyebrow">Get started</div>
			<div class="steps">
				{#each steps as step, i (step.label)}
					<svelte:element
						this={step.href ? 'a' : 'div'}
						href={step.href}
						class="step"
						class:done={step.done}
						class:active={i === activeIndex}
						class:linked={!!step.href}
					>
						<span class="mark">
							{#if step.done}
								<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							{:else}
								{i + 1}
							{/if}
						</span>
						<span class="text">
							<span class="label">{step.label}</span>
							{#if step.hint && i === activeIndex}
								<span class="hint">{step.hint}</span>
							{/if}
						</span>
					</svelte:element>
				{/each}
			</div>
		</div>
	</div>
{:else}
	<div class="chat-placeholder-panel">
		<div class="chat-placeholder">
			<div class="chat-placeholder-icon">💬</div>
			<h2>Select a chat</h2>
			<p>Choose a conversation from the list to start messaging.</p>
		</div>
	</div>
{/if}

<style>
	.onboarding-panel,
	.chat-placeholder-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: transparent;
		overflow: hidden;
		padding: 2rem;
	}

	.onboarding-card {
		width: 100%;
		max-width: 360px;
		padding: 1.25rem 1.375rem;
		border-radius: var(--radius-lg);
		background: var(--glass-bg, var(--panel-bg));
		border: 1px solid var(--glass-border, var(--border));
		box-shadow: var(--glass-shadow, var(--shadow-md));
		/* -webkit- listed first: the production CSS minifier collapses
		   identical-value backdrop-filter declarations into one and keeps
		   whichever is declared last - the standards property needs to be
		   second or it silently gets dropped. */
		-webkit-backdrop-filter: blur(var(--glass-blur, 0px));
		backdrop-filter: blur(var(--glass-blur, 0px));
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 0.75rem;
	}

	.steps {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.step {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.5625rem 0.625rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
	}

	.step.linked {
		cursor: pointer;
	}

	.step.linked:hover {
		background: var(--glass-bg-hover, var(--surface-hover));
	}

	.mark {
		width: 1.625rem;
		height: 1.625rem;
		border-radius: 999px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		background: var(--glass-bg, var(--surface));
		border: 1px solid var(--border);
		color: var(--text-muted);
	}

	.mark svg {
		width: 0.8125rem;
		height: 0.8125rem;
	}

	.step.done .mark {
		background: rgba(127, 216, 168, 0.18);
		border-color: transparent;
		color: #4ade80;
	}

	.step.active .mark {
		background: var(--accent);
		border-color: transparent;
		color: var(--accent-contrast, #fff);
		box-shadow: var(--accent-glow, none);
	}

	.step.active {
		background: var(--accent-subtle);
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding-top: 0.125rem;
	}

	.label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.step.done .label {
		color: var(--text-muted);
		text-decoration: line-through;
		text-decoration-color: var(--border);
	}

	.step.active .label {
		color: var(--text-primary);
	}

	.hint {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.chat-placeholder {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		text-align: center;
	}

	.chat-placeholder-icon {
		font-size: 2.5rem;
		opacity: 0.5;
		margin-bottom: 0.25rem;
	}

	.chat-placeholder h2 {
		margin: 0;
		color: var(--text-secondary);
		font-size: 1.0625rem;
	}

	.chat-placeholder p {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.8125rem;
		max-width: 280px;
	}
</style>
