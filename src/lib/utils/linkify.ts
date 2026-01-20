const HTTPS_URL_REGEX = /https:\/\/[^\s<>"'`]+[^\s<>"'`.,;!?]/gi;

export function linkify(text: string): string {
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
        .replace(/(?<!\S):evil:(?!\S)/g, '😈');

    return withEmojis.replace(HTTPS_URL_REGEX, (url) => {
        try {
            new URL(url);
            return `<a href="#" onclick="window.showLinkConfirmation && window.showLinkConfirmation('${url.replace(/'/g, '\\\'')}')" class="message-link">${url}</a>`;
        } catch {
            return url;
        }
    });
}