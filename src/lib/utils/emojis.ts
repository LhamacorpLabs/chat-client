export interface EmojiEntry {
	code: string;
	emoji: string;
}

export const emojis: EmojiEntry[] = [
	{ code: ':)', emoji: '🙂' },
	{ code: ':P', emoji: '😛' },
	{ code: ':/', emoji: '😕' },
	{ code: ':(', emoji: '😟' },
	{ code: ':O', emoji: '😲' },
	{ code: ':kiss:', emoji: '😘' },
	{ code: ':D', emoji: '😃' },
	{ code: ':thinking:', emoji: '🤔' },
	{ code: ':evil:', emoji: '😈' },
	{ code: ':devil:', emoji: '👹' },
	{ code: ':clown:', emoji: '🤡' },
	{ code: ':sic:', emoji: '🤢' },
	{ code: ':puto:', emoji: '🤬' },
	{ code: ':okay:', emoji: '👍' },
	{ code: ':rock:', emoji: '🤘' },
	{ code: ':gay:', emoji: '💅' },
	{ code: ':darkmoon:', emoji: '🌚' },
	{ code: ':lightmoon:', emoji: '🌝' },
	{ code: ':love:', emoji: '🧡' },
	{ code: ':sos:', emoji: '🆘' },
	{ code: ':alert:', emoji: '🚨' },
	{ code: ':party:', emoji: '🎉' },
];

export function getColonEmojis(): EmojiEntry[] {
	return emojis.filter(e => e.code.startsWith(':') && e.code.endsWith(':'));
}

export function searchEmojis(query: string): EmojiEntry[] {
	const q = query.toLowerCase();
	return getColonEmojis().filter(e => e.code.toLowerCase().includes(q));
}
