import { describe, it, expect } from 'vitest';
import { linkify } from '$lib/utils/linkify';

describe('linkify', () => {
	it('returns plain text as a single text segment', () => {
		const segments = linkify('hello world, no links here');

		expect(segments).toEqual([{ type: 'text', value: 'hello world, no links here' }]);
	});

	it('never produces HTML - message content stays inert data', () => {
		// This is the actual XSS-relevant guarantee: linkify no longer builds
		// any HTML string (no {@html} sink exists for message text anymore),
		// so text that looks like markup just comes back as a literal text
		// segment. Svelte's own text interpolation is what makes rendering
		// it safe - there's nothing left for linkify itself to escape.
		const dangerous = '<img src=x onerror=alert(1)> and <script>alert(2)</script>';
		const segments = linkify(dangerous);

		expect(segments).toEqual([{ type: 'text', value: dangerous }]);
	});

	it('splits text around a single URL into text/link/text segments', () => {
		const segments = linkify('check this out https://example.com/page it is cool');

		expect(segments).toEqual([
			{ type: 'text', value: 'check this out ' },
			{ type: 'link', url: 'https://example.com/page' },
			{ type: 'text', value: ' it is cool' }
		]);
	});

	it('handles a message that is only a URL', () => {
		const segments = linkify('https://example.com/only-link');

		expect(segments).toEqual([{ type: 'link', url: 'https://example.com/only-link' }]);
	});

	it('handles multiple URLs in one message', () => {
		const segments = linkify('https://a.example.com then https://b.example.com');

		expect(segments).toEqual([
			{ type: 'link', url: 'https://a.example.com' },
			{ type: 'text', value: ' then ' },
			{ type: 'link', url: 'https://b.example.com' }
		]);
	});

	it('does not treat a bare http:// URL as a link (only https:// is matched)', () => {
		const segments = linkify('go to http://insecure.example.com now');

		expect(segments).toEqual([{ type: 'text', value: 'go to http://insecure.example.com now' }]);
	});

	it('substitutes known emoticons with emoji', () => {
		const segments = linkify(':) :D :thinking:');

		expect(segments).toEqual([{ type: 'text', value: '🙂 😃 🤔' }]);
	});

	it('does not substitute emoticons embedded in a larger word', () => {
		const segments = linkify('nope:)notreally');

		expect(segments).toEqual([{ type: 'text', value: 'nope:)notreally' }]);
	});

	it('omits previews/gifs by default (single-arg call)', () => {
		const segments = linkify('https://github.com/lhamacorp/chat-client');

		// Single-arg overload returns a bare segment array, not a LinkifyResult
		expect(Array.isArray(segments)).toBe(true);
	});

	it('collects a link preview when includePreviews is true', () => {
		const result = linkify('check https://github.com/lhamacorp/chat-client out', true);

		expect(result.segments).toEqual([
			{ type: 'text', value: 'check ' },
			{ type: 'link', url: 'https://github.com/lhamacorp/chat-client' },
			{ type: 'text', value: ' out' }
		]);
		expect(result.previews.length).toBe(1);
		expect(result.previews[0].url).toBe('https://github.com/lhamacorp/chat-client');
		expect(result.gifs).toEqual([]);
	});

	it('extracts a GIF URL into gifs[] and omits it from segments entirely', () => {
		const result = linkify('look at this https://media1.giphy.com/foo.gif cool right', true);

		expect(result.segments).toEqual([
			{ type: 'text', value: 'look at this ' },
			{ type: 'text', value: ' cool right' }
		]);
		expect(result.gifs.length).toBe(1);
		expect(result.gifs[0].url).toBe('https://media1.giphy.com/foo.gif');
		expect(result.gifs[0].isGif).toBe(true);
		expect(result.previews).toEqual([]);
	});

	it('does not detect gifs/previews when includePreviews is false, even for a gif-looking URL', () => {
		const segments = linkify('https://media1.giphy.com/foo.gif');

		// Without includePreviews, gif URLs are treated as regular links -
		// the gif-detection branch only runs when previews are requested.
		expect(segments).toEqual([{ type: 'link', url: 'https://media1.giphy.com/foo.gif' }]);
	});
});
