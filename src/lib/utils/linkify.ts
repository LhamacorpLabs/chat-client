import { emojis } from './emojis';
import { emotes } from './emotes';
import { detectLinkPreview, type LinkPreview } from './linkPreview';

const HTTPS_URL_REGEX = /https:\/\/[^\s<>"'`]+[^\s<>"'`.,;!?]/gi;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const wordBounded = (code: string) => `(?<!\\S)${escapeRegex(code)}(?!\\S)`;

const EMOJI_REPLACEMENTS: Array<[RegExp, string]> = emojis.map(({ code, emoji }) => [
	new RegExp(wordBounded(code), 'g'),
	emoji
]);

const EMOTE_SRCS = new Map(emotes.map(({ code, src }) => [code, src]));
const EMOTE_REGEX = EMOTE_SRCS.size
	? new RegExp([...EMOTE_SRCS.keys()].map(wordBounded).join('|'), 'g')
	: null;

function textSegments(text: string): LinkifySegment[] {
	if (!EMOTE_REGEX) return [{ type: 'text', value: text }];

	const segments: LinkifySegment[] = [];
	let last = 0;
	for (const match of text.matchAll(EMOTE_REGEX)) {
		if (match.index > last) segments.push({ type: 'text', value: text.slice(last, match.index) });
		segments.push({ type: 'emote', code: match[0], src: EMOTE_SRCS.get(match[0])! });
		last = match.index + match[0].length;
	}
	if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
	return segments;
}

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
	| { type: 'emote'; code: string; src: string }
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
			segments.push(...textSegments(withEmojis.slice(lastIndex, match.index)));
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
		const lhamaImageTest = /https:\/\/(img|i)\.(lhama\.io|lhamacorp\.com|blacktilde\.com)\//i.test(url);
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
		segments.push(...textSegments(withEmojis.slice(lastIndex)));
	}

	const result = includePreviews ? { segments, previews, gifs } : segments;

	// Cache the result for future use
	linkifyCache.set(cacheKey, result);

	return result;
}
