<!-- Shown in the main column when no chat is open (desktop only - on
     mobile the sidebar is the whole screen while on this route, so this
     panel never actually becomes visible there). -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/stores/auth';
	import { chatStore } from '$lib/stores/chat';

	let isElectron = $state(typeof window !== 'undefined' && !!window.electronAPI);

	let hasChats = $derived($chatStore.chats.length > 0);
	let hasInvited = $derived($chatStore.chats.some(chat => chat.members.length > 1));

	let steps = $derived([
		{
			label: 'Create your first chat',
			hint: 'Use the + button in the sidebar, or press C',
			href: null,
			done: hasChats
		},
		{
			label: 'Invite a teammate',
			hint: 'Open a chat and click Invite',
			href: null,
			done: hasInvited
		},
		{
			label: 'Get the desktop app',
			hint: 'Native notifications and auto-updates',
			href: isElectron ? null : resolve('/download'),
			done: isElectron
		}
	]);

	let activeIndex = $derived(steps.findIndex(step => !step.done));
	let doneCount = $derived(steps.filter(step => step.done).length);

	function greeting(): string {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 18) return 'Good afternoon';
		return 'Good evening';
	}
</script>

<div class="welcome">
	<div class="welcome-inner">
		<img class="welcome-mark" src="/logo.png" alt="" />
		<h1>{greeting()}, {$authStore.user?.username}</h1>
		<p class="lead">
			{#if hasChats}
				Pick a conversation from the sidebar to jump back in.
			{:else}
				Create a chat or join one with an invite code to get started.
			{/if}
		</p>

		{#if activeIndex !== -1}
			<section class="setup" aria-label="Get started">
				<header class="setup-header">
					<span>Get started</span>
					<span class="setup-progress">{doneCount} of {steps.length}</span>
				</header>
				<div class="progress-track" aria-hidden="true">
					<div class="progress-fill" style={`width: ${(doneCount / steps.length) * 100}%`}></div>
				</div>
				<ol class="steps">
					{#each steps as step, i (step.label)}
						<li>
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
									{#if !step.done}
										<span class="hint">{step.hint}</span>
									{/if}
								</span>
								{#if step.href && !step.done}
									<svg class="step-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true">
										<path d="M5 12h14M13 6l6 6-6 6" />
									</svg>
								{/if}
							</svelte:element>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<dl class="shortcuts">
			<div><dt><kbd>↑</kbd><kbd>↓</kbd></dt><dd>Browse chats</dd></div>
			<div><dt><kbd>C</kbd></dt><dd>Create</dd></div>
			<div><dt><kbd>J</kbd></dt><dd>Join</dd></div>
		</dl>
	</div>
</div>

<style>
	.welcome {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow-y: auto;
		padding: 2rem;
		background:
			radial-gradient(60% 50% at 50% 0%, var(--accent-subtle), transparent 70%),
			var(--app-bg);
	}

	.welcome-inner {
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		animation: fadeIn 0.4s var(--ease-out-expo);
	}

	.welcome-mark {
		width: 52px;
		height: 52px;
		border-radius: 14px;
		margin-bottom: 1.25rem;
		box-shadow: var(--shadow-md);
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 1.5rem;
		font-weight: 650;
	}

	.lead {
		margin: 0 0 2rem;
		font-size: 0.9375rem;
		color: var(--text-secondary);
		max-width: 340px;
		text-wrap: balance;
	}

	.setup {
		width: 100%;
		text-align: left;
		padding: 1rem;
		border-radius: var(--radius-lg);
		background: var(--panel-bg);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-md);
	}

	.setup-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 0.25rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.setup-progress {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.progress-track {
		height: 4px;
		margin: 0.625rem 0.25rem 0.75rem;
		border-radius: 999px;
		background: var(--surface-alt);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
		transition: width 0.4s var(--ease-out-expo);
	}

	.steps {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem;
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: background-color 0.15s ease;
	}

	.step.linked {
		cursor: pointer;
	}

	.step.linked:hover {
		background: var(--surface-hover);
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
		font-weight: 600;
		border: 1px solid var(--border-hover);
		color: var(--text-muted);
	}

	.mark svg {
		width: 0.8125rem;
		height: 0.8125rem;
	}

	.step.done .mark {
		background: var(--success-bg);
		border-color: transparent;
		color: var(--success-text);
	}

	.step.active .mark {
		background: var(--accent);
		border-color: transparent;
		color: var(--accent-contrast);
		box-shadow: 0 0 0 4px var(--accent-subtle);
	}

	.text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		min-width: 0;
	}

	.label {
		font-size: 0.875rem;
		font-weight: 550;
		color: var(--text-secondary);
	}

	.step.done .label {
		color: var(--text-muted);
		text-decoration: line-through;
		text-decoration-color: var(--border-hover);
	}

	.step.active .label {
		color: var(--text-primary);
	}

	.hint {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.step-arrow {
		flex-shrink: 0;
		color: var(--text-muted);
		transition: transform 0.15s ease, color 0.15s ease;
	}

	.step.linked:hover .step-arrow {
		color: var(--text-primary);
		transform: translateX(2px);
	}

	.shortcuts {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem 1.25rem;
		margin-top: 1.75rem;
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.shortcuts div {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.shortcuts dt {
		display: flex;
		gap: 0.1875rem;
	}

	kbd {
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3125rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--text-secondary);
		background: var(--surface);
		border: 1px solid var(--border-hover);
		border-bottom-width: 2px;
		border-radius: 5px;
	}
</style>
