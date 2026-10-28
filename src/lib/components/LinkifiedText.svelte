<script lang="ts">
	import type { LinkifySegment } from '../utils/linkify';

	interface Props {
		segments: LinkifySegment[];
		onLinkClick: (url: string) => void;
	}

	let { segments, onLinkClick }: Props = $props();

	function handleClick(event: MouseEvent, url: string) {
		event.preventDefault();
		onLinkClick(url);
	}
</script>

{#each segments as segment, index (index)}
	{#if segment.type === 'link'}
		<a href={segment.url} rel="external" class="message-link" onclick={(e) => handleClick(e, segment.url)}>{segment.url}</a>
	{:else if segment.type === 'emote'}
		<img class="message-emote" src={segment.src} alt={segment.code} title={segment.code} />
	{:else}
		{segment.value}
	{/if}
{/each}
