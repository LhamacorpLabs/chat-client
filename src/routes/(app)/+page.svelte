<!-- Shown in the main column when no chat is open (desktop only - on
     mobile the sidebar is the whole screen while on this route, so this
     panel never actually becomes visible there). -->
<div class="chat-placeholder-panel">
	<div class="chat-placeholder">
		<div class="chat-placeholder-icon">💬</div>
		<h2>Select a chat</h2>
		<p>Choose a conversation from the list to start messaging.</p>
	</div>
</div>

<style>
	.chat-placeholder-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: transparent;
		overflow: hidden;
	}

	.chat-placeholder {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
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
