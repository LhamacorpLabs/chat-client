import { detectLinkPreview, type LinkPreview } from './linkPreview';

const HTTPS_URL_REGEX = /https:\/\/[^\s<>"'`]+[^\s<>"'`.,;!?]/gi;

const EMOJI_REPLACEMENTS: Array<[RegExp, string]> = [
	[/(?<!\S):\)(?!\S)/g, '🙂'],
	[/(?<!\S):P(?!\S)/g, '😛'],
	[/(?<!\S):\/(?!\S)/g, '😕'],
	[/(?<!\S):\((?!\S)/g, '😟'],
	[/(?<!\S):O(?!\S)/g, '😲'],
	[/(?<!\S):kiss:(?!\S)/g, '😘'],
	[/(?<!\S):D(?!\S)/g, '😃'],
	[/(?<!\S):thinking:(?!\S)/g, '🤔'],
	[/(?<!\S):evil:(?!\S)/g, '😈'],
	[/(?<!\S):devil:(?!\S)/g, '👹'],
	[/(?<!\S):clown:(?!\S)/g, '🤡'],
	[/(?<!\S):sic:(?!\S)/g, '🤢'],
	[/(?<!\S):puto:(?!\S)/g, '🤬'],
	[/(?<!\S):okay:(?!\S)/g, '👍'],
	[/(?<!\S):rock:(?!\S)/g, '🤘'],
	[/(?<!\S):gay:(?!\S)/g, '💅'],
	[/(?<!\S):darkmoon:(?!\S)/g, '🌚'],
	[/(?<!\S):lightmoon:(?!\S)/g, '🌝'],
	[/(?<!\S):love:(?!\S)/g, '🧡'],
	[/(?<!\S):sos:(?!\S)/g, '🆘'],
	[/(?<!\S):alert:(?!\S)/g, '🚨'],
	[/(?<!\S):party:(?!\S)/g, '🎉']
];

function applyEmojis(text: string): string {
	return EMOJI_REPLACEMENTS.reduce((acc, [pattern, emoji]) => acc.replace(pattern, emoji), text);
}

// Memoization cache for linkify results to improve performance
const linkifyCache = new Map<string, LinkifyResult | LinkifySegment[]>();
const MAX_CACHE_SIZE = 1000; // Limit cache size to prevent memory bloat

// Cache cleanup function to prevent unbounded growth
function cleanupCache() {
	if (linkifyCache.size > MAX_CACHE_SIZE) {
		// Remove oldest 25% of entries
		const keysToDelete = Array.from(linkifyCache.keys()).slice(0, Math.floor(MAX_CACHE_SIZE * 0.25));
		for (const key of keysToDelete) {
			linkifyCache.delete(key);
		}
	}
}

export interface GifLink {
	url: string;
	id: string;
	isGif: boolean;
}

// Plain data, never HTML: a message is rendered by mapping these to real
// Svelte elements (see LinkifiedText.svelte), so there's no {@html} sink for
// message content to ever pass through.
export type LinkifySegment =
	| { type: 'text'; value: string }
	| { type: 'link'; url: string };

export interface LinkifyResult {
	segments: LinkifySegment[];
	previews: LinkPreview[];
	gifs: GifLink[];
}

export function linkify(text: string): LinkifySegment[];
export function linkify(text: string, includePreviews: true): LinkifyResult;
export function linkify(text: string, includePreviews = false): LinkifySegment[] | LinkifyResult {
	// Create cache key that includes the includePreviews flag
	const cacheKey = `${text}|${includePreviews}`;

	// Check cache first
	const cached = linkifyCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	// Clean up cache if it's getting too large
	cleanupCache();

	const withEmojis = applyEmojis(text);

	const previews: LinkPreview[] = [];
	const gifs: GifLink[] = [];
	const segments: LinkifySegment[] = [];

	// Fresh instance per call: reusing a shared `g`-flag regex across calls
	// via exec() would leak `lastIndex` state between them.
	const urlRegex = new RegExp(HTTPS_URL_REGEX);
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = urlRegex.exec(withEmojis)) !== null) {
		const url = match[0];

		if (match.index > lastIndex) {
			segments.push({ type: 'text', value: withEmojis.slice(lastIndex, match.index) });
		}
		lastIndex = match.index + url.length;

		try {
			new URL(url);
		} catch {
			// Matched the pattern but isn't actually a valid URL - keep as
			// plain text.
			segments.push({ type: 'text', value: url });
			continue;
		}

		// Check if this is a GIF/image URL (fresh regex instances, same reason as above)
		const gifUrlTest = /https:\/\/[^\s<>"'`]*\.gif(\?[^\s<>"'`]*)?/i.test(url);
		const gifDomainTest = /https:\/\/(media[0-9]*\.)?(giphy\.com|tenor\.com|gfycat\.com|imgur\.com)/i.test(url);
		const lhamaImageTest = /https:\/\/(img|i)\.(lhama\.io|lhamacorp\.com)\//i.test(url);
		const isGifUrl = gifUrlTest || gifDomainTest || lhamaImageTest;

		if (includePreviews && isGifUrl) {
			const contentUrl = lhamaImageTest ? url.replace(/\/?$/, '/content') : url;
			gifs.push({
				url: contentUrl,
				id: `gif_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
				isGif: gifUrlTest || gifDomainTest
			});

			// Hide the URL text - the GIF will be displayed by the MessageGif component
			continue;
		}

		if (includePreviews) {
			// Detect link preview for non-GIF URLs
			const preview = detectLinkPreview(url);
			if (preview) {
				previews.push(preview);
			}
		}

		segments.push({ type: 'link', url });
	}

	if (lastIndex < withEmojis.length) {
		segments.push({ type: 'text', value: withEmojis.slice(lastIndex) });
	}

	const result = includePreviews ? { segments, previews, gifs } : segments;

	// Cache the result for future use
	linkifyCache.set(cacheKey, result);

	return result;
}
