import { detectLinkPreview, type LinkPreview } from './linkPreview';

const HTTPS_URL_REGEX = /https:\/\/[^\s<>"'`]+[^\s<>"'`.,;!?]/gi;

export interface GifLink {
	url: string;
	id: string; // unique identifier for the gif
}

export interface LinkifyResult {
	html: string;
	previews: LinkPreview[];
	gifs: GifLink[];
}

export function linkify(text: string): string;
export function linkify(text: string, includePreviews: true): LinkifyResult;
export function linkify(text: string, includePreviews = false): string | LinkifyResult {
    const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    const withEmojis = escapedText
        .replace(/(?<!\S):\)(?!\S)/g, '🙂')
        .replace(/(?<!\S):P(?!\S)/g, '😛')
        .replace(/(?<!\S):\/(?!\S)/g, '😕')
        .replace(/(?<!\S):\((?!\S)/g, '😟')
        .replace(/(?<!\S):O(?!\S)/g, '😲')
        .replace(/(?<!\S):kiss:(?!\S)/g, '😘')
        .replace(/(?<!\S):D(?!\S)/g, '😃')
        .replace(/(?<!\S):thinking:(?!\S)/g, '🤔')
        .replace(/(?<!\S):evil:(?!\S)/g, '😈')
        .replace(/(?<!\S):devil:(?!\S)/g, '👹')
        .replace(/(?<!\S):clown:(?!\S)/g, '🤡')
        .replace(/(?<!\S):sic:(?!\S)/g, '🤢')
        .replace(/(?<!\S):puto:(?!\S)/g, '🤬')
        .replace(/(?<!\S):okay:(?!\S)/g, '👍')
        .replace(/(?<!\S):rock:(?!\S)/g, '🤘')
        .replace(/(?<!\S):gay:(?!\S)/g, '💅')
        .replace(/(?<!\S):darkmoon:(?!\S)/g, '🌚')
        .replace(/(?<!\S):lightmoon:(?!\S)/g, '🌝')
        .replace(/(?<!\S):love:(?!\S)/g, '🧡')
    ;

    const previews: LinkPreview[] = [];
    const gifs: GifLink[] = [];

    const linkedText = withEmojis.replace(HTTPS_URL_REGEX, (url) => {
        try {
            new URL(url);

            // Check if this is a GIF URL (create new regex instances to avoid global flag issues)
            const gifUrlTest = /https:\/\/[^\s<>"'`]*\.(gif)(\?[^\s<>"'`]*)?/i.test(url);
            const gifDomainTest = /https:\/\/(media[0-9]*\.)?(giphy\.com|tenor\.com|gfycat\.com|imgur\.com)/i.test(url);
            const isGifUrl = gifUrlTest || gifDomainTest;

            if (includePreviews && isGifUrl) {
                // Add to GIF collection
                gifs.push({
                    url: url,
                    id: `gif_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`
                });

                // Hide the URL text - the GIF will be displayed by the MessageGif component
                return '';
            } else if (includePreviews) {
                // Detect link preview for non-GIF URLs
                const preview = detectLinkPreview(url);
                if (preview) {
                    previews.push(preview);
                }
            }

            return `<a href="#" onclick="window.showLinkConfirmation && window.showLinkConfirmation('${url.replace(/'/g, '\\\'')}')" class="message-link">${url}</a>`;
        } catch {
            return url;
        }
    });

    if (includePreviews) {
        return {
            html: linkedText,
            previews,
            gifs
        };
    }

    return linkedText;
}