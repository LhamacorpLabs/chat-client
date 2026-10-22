<script lang="ts">
	import { debugLog, debugPanelOpen, clearDebugLog, type DebugEntry, type DebugEntryKind } from '$lib/stores/debugLog';

	type Filter = 'all' | DebugEntryKind;
	type View = 'log' | 'endpoints';

	let filter = $state<Filter>('all');
	let view = $state<View>('log');
	let search = $state('');
	let expandedId = $state<number | null>(null);
	let now = $state(Date.now());

	const filters: Filter[] = ['all', 'http', 'auth', 'mqtt'];

	// Ticks only while the panel is open, for the token countdown and "ago" times.
	$effect(() => {
		if (!$debugPanelOpen) return;
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			debugPanelOpen.update(open => !open);
		} else if (event.key === 'Escape' && $debugPanelOpen) {
			debugPanelOpen.set(false);
		}
	}

	const visibleEntries = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return $debugLog
			.filter(entry => filter === 'all' || entry.kind === filter)
			.filter(entry => !query || `${entry.label} ${entry.detail} ${entry.error ?? ''}`.toLowerCase().includes(query))
			.reverse();
	});

	interface EndpointStats {
		key: string;
		count: number;
		lastTime: number;
		avgIntervalMs: number | null;
		errors: number;
	}

	// Grouping by endpoint makes a request that fires on a timer stand out.
	const endpoints = $derived.by(() => {
		const groups: Record<string, DebugEntry[]> = {};
		for (const entry of $debugLog) {
			if (entry.kind !== 'http') continue;
			const key = `${entry.label} ${pathOf(entry.detail)}`;
			(groups[key] ??= []).push(entry);
		}

		const stats: EndpointStats[] = Object.entries(groups).map(([key, entries]) => {
			const first = entries[0].time;
			const last = entries[entries.length - 1].time;
			return {
				key,
				count: entries.length,
				lastTime: last,
				avgIntervalMs: entries.length > 1 ? (last - first) / (entries.length - 1) : null,
				errors: entries.filter(entry => entry.error || (entry.status ?? 0) >= 400).length
			};
		});

		const query = search.trim().toLowerCase();
		return stats
			.filter(stat => !query || stat.key.toLowerCase().includes(query))
			.sort((a, b) => b.count - a.count);
	});

	// Reading auth_data directly: the panel shows when the token expires, never the token.
	const tokenExpiresAt = $derived.by(() => {
		void now;
		try {
			const saved = localStorage.getItem('auth_data');
			const expiration = saved ? JSON.parse(saved).expirationDate : null;
			return expiration ? new Date(expiration).getTime() : null;
		} catch {
			return null;
		}
	});

	function pathOf(url: string): string {
		try {
			const parsed = new URL(url);
			return `${parsed.host}${parsed.pathname}`;
		} catch {
			return url;
		}
	}

	function formatTime(time: number): string {
		const date = new Date(time);
		const pad = (value: number, size = 2) => String(value).padStart(size, '0');
		return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
	}

	function formatDuration(ms: number): string {
		const sign = ms < 0 ? '-' : '';
		let seconds = Math.floor(Math.abs(ms) / 1000);
		const days = Math.floor(seconds / 86400);
		seconds %= 86400;
		const hours = Math.floor(seconds / 3600);
		seconds %= 3600;
		const minutes = Math.floor(seconds / 60);
		seconds %= 60;

		if (days) return `${sign}${days}d ${hours}h`;
		if (hours) return `${sign}${hours}h ${minutes}m`;
		if (minutes) return `${sign}${minutes}m ${seconds}s`;
		return `${sign}${seconds}s`;
	}

	function statusClass(entry: DebugEntry): string {
		if (entry.error || (entry.status ?? 0) >= 400) return 'bad';
		if (entry.pending) return 'pending';
		return '';
	}

	function toggleExpanded(id: number) {
		expandedId = expandedId === id ? null : id;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $debugPanelOpen}
	<section class="debug-panel" aria-label="Debug panel">
		<header>
			<strong>Debug</strong>
			<span class="token-info">
				{#if tokenExpiresAt === null}
					no token
				{:else if tokenExpiresAt <= now}
					token expired {formatDuration(now - tokenExpiresAt)} ago
				{:else}
					token expires in {formatDuration(tokenExpiresAt - now)}
				{/if}
			</span>

			<div class="segmented" role="group" aria-label="View">
				<button class:active={view === 'log'} onclick={() => (view = 'log')}>Log</button>
				<button class:active={view === 'endpoints'} onclick={() => (view = 'endpoints')}>By endpoint</button>
			</div>

			{#if view === 'log'}
				<div class="segmented" role="group" aria-label="Filter">
					{#each filters as option (option)}
						<button class:active={filter === option} onclick={() => (filter = option)}>{option}</button>
					{/each}
				</div>
			{/if}

			<input type="search" placeholder="Filter…" bind:value={search} aria-label="Filter entries" />

			<span class="spacer"></span>
			<button class="text-button" onclick={clearDebugLog}>Clear</button>
			<button class="close" onclick={() => debugPanelOpen.set(false)} aria-label="Close debug panel">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14" aria-hidden="true">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		</header>

		<div class="body">
			{#if view === 'log'}
				{#if visibleEntries.length === 0}
					<p class="empty">Nothing logged yet.</p>
				{:else}
					<table>
						<tbody>
							{#each visibleEntries as entry (entry.id)}
								<tr class="row {statusClass(entry)}" onclick={() => toggleExpanded(entry.id)}>
									<td class="time">{formatTime(entry.time)}</td>
									<td><span class="kind kind-{entry.kind}">{entry.kind}</span></td>
									<td class="label">{entry.label}</td>
									<td class="detail">{entry.detail}</td>
									<td class="status">
										{#if entry.pending}…{:else if entry.error}failed{:else if entry.status}{entry.status}{/if}
									</td>
									<td class="duration">{entry.durationMs !== undefined ? `${entry.durationMs} ms` : ''}</td>
								</tr>
								{#if expandedId === entry.id}
									<tr class="expanded">
										<td colspan="6">
											{#if entry.error}<div class="error">{entry.error}</div>{/if}
											{#if entry.stack}<pre>{entry.stack}</pre>{:else}<span class="muted">No stack available.</span>{/if}
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				{/if}
			{:else if endpoints.length === 0}
				<p class="empty">No requests yet.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Endpoint</th>
							<th>Calls</th>
							<th>Every</th>
							<th>Last</th>
							<th>Errors</th>
						</tr>
					</thead>
					<tbody>
						{#each endpoints as stat (stat.key)}
							<tr class:bad={stat.errors > 0}>
								<td class="detail">{stat.key}</td>
								<td>{stat.count}</td>
								<td>{stat.avgIntervalMs !== null ? `~${formatDuration(stat.avgIntervalMs)}` : ''}</td>
								<td>{formatDuration(now - stat.lastTime)} ago</td>
								<td>{stat.errors || ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</section>
{/if}

<style>
	.debug-panel {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		height: min(45vh, 420px);
		display: flex;
		flex-direction: column;
		background: var(--panel-bg);
		color: var(--text-primary);
		border-top: 1px solid var(--border-hover);
		box-shadow: var(--shadow-lg);
		font-size: 0.75rem;
		z-index: 1300;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 6px 8px 6px 12px;
		border-bottom: 1px solid var(--border);
	}

	.token-info {
		color: var(--text-muted);
		font-family: var(--font-mono, monospace);
	}

	.spacer {
		flex: 1;
	}

	.segmented {
		display: flex;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.segmented button,
	.text-button {
		height: 24px;
		padding: 0 8px;
		border: none;
		background: transparent;
		color: var(--text-secondary);
		font-family: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.segmented button.active {
		background: var(--accent-subtle);
		color: var(--accent);
	}

	.segmented button:hover,
	.text-button:hover {
		background: var(--surface-hover);
	}

	input[type='search'] {
		height: 24px;
		width: 160px;
		padding: 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--app-bg);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 0.75rem;
	}

	.text-button {
		border-radius: var(--radius-sm);
	}

	.close {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}

	.close:hover {
		background: var(--surface-hover);
		color: var(--text-primary);
	}

	.body {
		flex: 1;
		overflow: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-mono, monospace);
	}

	th {
		position: sticky;
		top: 0;
		background: var(--panel-bg);
		color: var(--text-muted);
		font-weight: 500;
		text-align: left;
	}

	th,
	td {
		padding: 3px 8px;
		white-space: nowrap;
		vertical-align: top;
	}

	tbody tr {
		border-bottom: 1px solid var(--border);
	}

	.row {
		cursor: pointer;
	}

	.row:hover {
		background: var(--surface-hover);
	}

	.time,
	.duration,
	.muted {
		color: var(--text-muted);
	}

	.detail {
		width: 100%;
		max-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.label {
		font-weight: 600;
	}

	.kind {
		display: inline-block;
		min-width: 34px;
		padding: 0 4px;
		border-radius: var(--radius-sm);
		text-align: center;
		background: var(--surface-hover);
		color: var(--text-secondary);
	}

	.kind-auth {
		background: var(--accent-subtle);
		color: var(--accent);
	}

	.bad td,
	.bad .status {
		color: var(--error-text);
	}

	.pending .status {
		color: var(--text-muted);
	}

	.expanded td {
		white-space: normal;
		background: var(--surface-alt, var(--app-bg));
	}

	.expanded pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-all;
		color: var(--text-secondary);
	}

	.error {
		margin-bottom: 4px;
		color: var(--error-text);
	}

	.empty {
		margin: 0;
		padding: 16px 12px;
		color: var(--text-muted);
	}
</style>
