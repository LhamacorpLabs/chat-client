// Deterministic-but-varied avatar color per chat, so each chat's icon
// reads as a distinct destination rather than a wall of identical circles
// - same idea as Slack/Discord's per-channel color. Shared between the
// rail's chat stack and the chat header so a chat's avatar color matches
// wherever it's shown.
const PALETTE = ['#ff6fa8', '#7c6fee', '#4fd6d0', '#f0b429', '#7fd8a8', '#6fa8ff'];

export function colorForChat(id: string): string {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	return PALETTE[hash % PALETTE.length];
}
