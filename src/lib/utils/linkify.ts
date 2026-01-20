import { detectLinkPreview, type LinkPreview } from './linkPreview';

const HTTPS_URL_REGEX = /https:\/\/[^\s<>"'`]+[^\s<>"'`.,;!?]/gi;

export interface LinkifyResult {
	html: string;
	previews: LinkPreview[];
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
        .replace(/(?<!\S):devil:(?!\S)/g, '👿')
        .replace(/(?<!\S):sic:(?!\S)/g, '🤢')
        .replace(/(?<!\S):puto:(?!\S)/g, '🤬')
    ;

    const previews: LinkPreview[] = [];

    const linkedText = withEmojis.replace(HTTPS_URL_REGEX, (url) => {
        try {
            new URL(url);

            // Detect link preview if requested
            if (includePreviews) {
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
            previews
        };
    }

    return linkedText;
}