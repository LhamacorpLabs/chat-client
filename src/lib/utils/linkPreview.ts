export interface LinkPreview {
	platform: 'youtube' | 'instagram' | 'spotify' | 'twitter' | 'github' | 'amazon' | 'lhamacorp' | 'unknown';
	url: string;
	id?: string;
	title: string;
	description?: string;
	contentType?: string;
	icon: string;
	color: string;
}

function isLegitimateHostname(hostname: string, legitimateDomains: string[]): boolean {
	const lowerHostname = hostname.toLowerCase();

	return legitimateDomains.some(domain => {
		const lowerDomain = domain.toLowerCase();
		return lowerHostname === lowerDomain || lowerHostname.endsWith('.' + lowerDomain);
	});
}

/**
 * Detects platform type from URL and extracts basic information
 */
export function detectLinkPreview(url: string): LinkPreview | null {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();

		if (isLegitimateHostname(hostname, ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com', 'www.youtube.com'])) {
			return detectYoutube(url, urlObj);
		}

		if (isLegitimateHostname(hostname, ['instagram.com', 'instagr.am', 'www.instagram.com'])) {
			return detectInstagram(url, urlObj);
		}

		if (isLegitimateHostname(hostname, ['spotify.com', 'open.spotify.com', 'play.spotify.com'])) {
			return detectSpotify(url, urlObj);
		}

		if (isLegitimateHostname(hostname, ['twitter.com', 'x.com', 't.co', 'www.twitter.com', 'mobile.twitter.com'])) {
			return detectTwitter(url, urlObj);
		}

		if (isLegitimateHostname(hostname, ['github.com', 'gist.github.com', 'www.github.com'])) {
			return detectGitHub(url, urlObj);
		}

		if (isLegitimateHostname(hostname, [
			'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
			'amazon.ca', 'amazon.com.au', 'amazon.co.jp', 'amazon.in', 'amazon.com.br',
			'amazon.com.mx', 'amazon.nl', 'amazon.se', 'amazon.com.tr', 'amazon.ae',
			'amzn.to', 'amzn.com', 'www.amazon.com', 'smile.amazon.com'
		])) {
			return detectAmazon(url, urlObj);
		}

		if (isLegitimateHostname(hostname, ['lhamacorp.com', 'www.lhamacorp.com'])) {
			return detectLhamacorp(url, urlObj);
		}

		return null;
	} catch {
		return null;
	}
}

function detectYoutube(url: string, urlObj: URL): LinkPreview {
	let videoId = '';
	let contentType = 'Video';
	let title = 'YouTube Video';
	let description;

	if (urlObj.hostname.includes('youtu.be')) {
		videoId = urlObj.pathname.slice(1).split('?')[0];
	} else if (urlObj.hostname.includes('youtube.com')) {
		const pathParts = urlObj.pathname.split('/');

		if (urlObj.searchParams.get('v')) {
			videoId = urlObj.searchParams.get('v') || '';
		} else if (pathParts.includes('embed')) {
			const embedIndex = pathParts.indexOf('embed');
			videoId = pathParts[embedIndex + 1] || '';
		} else if (pathParts.includes('shorts')) {
			const shortsIndex = pathParts.indexOf('shorts');
			videoId = pathParts[shortsIndex + 1] || '';
			contentType = 'Short';
		} else if (pathParts.includes('playlist')) {
			const playlistId = urlObj.searchParams.get('list');
			if (playlistId) {
				title = 'YouTube Playlist';
				contentType = 'Playlist';
				description = `Playlist ID: ${playlistId.substring(0, 8)}...`;
			}
		} else if (pathParts.includes('channel') || pathParts.includes('c') || pathParts.includes('user')) {
			title = 'YouTube Channel';
			contentType = 'Channel';
		}
	}

	const timestamp = urlObj.searchParams.get('t');
	if (timestamp && videoId) {
		description = `Starting at ${timestamp}`;
	}

	if (videoId) {
		title = contentType === 'Short' ? 'YouTube Short' : 'YouTube Video';
		if (!description) {
			description = `Video ID: ${videoId}`;
		}
	}

	return {
		platform: 'youtube',
		url,
		id: videoId,
		title,
		description,
		contentType,
		icon: '🎥',
		color: '#FF0000'
	};
}

function detectInstagram(url: string, urlObj: URL): LinkPreview {
	let postId = '';
	let contentType = 'Post';
	let title = 'Instagram Post';
	let description;

	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('p')) {
		const pIndex = pathParts.indexOf('p');
		postId = pathParts[pIndex + 1] || '';
		contentType = 'Post';
		title = 'Instagram Post';
	} else if (pathParts.includes('reel')) {
		const reelIndex = pathParts.indexOf('reel');
		postId = pathParts[reelIndex + 1] || '';
		contentType = 'Reel';
		title = 'Instagram Reel';
	} else if (pathParts.includes('stories')) {
		const storiesIndex = pathParts.indexOf('stories');
		const username = pathParts[storiesIndex + 1];
		postId = pathParts[storiesIndex + 2] || '';
		contentType = 'Story';
		title = 'Instagram Story';
		if (username) {
			description = `@${username}'s story`;
		}
	} else if (pathParts.includes('tv')) {
		const tvIndex = pathParts.indexOf('tv');
		postId = pathParts[tvIndex + 1] || '';
		contentType = 'IGTV';
		title = 'Instagram TV';
	} else if (pathParts.length === 1 && pathParts[0]) {
		const username = pathParts[0];
		contentType = 'Profile';
		title = 'Instagram Profile';
		description = `@${username}`;
	}

	if (postId && !description) {
		description = `Post ID: ${postId}`;
	}

	return {
		platform: 'instagram',
		url,
		id: postId,
		title,
		description,
		contentType,
		icon: '📸',
		color: '#E4405F'
	};
}

function detectSpotify(url: string, urlObj: URL): LinkPreview {
	let spotifyId = '';
	let contentType = 'Track';
	let title = 'Spotify Track';
	let description;

	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	const contentTypes = [
		{ key: 'track', type: 'Track', title: 'Spotify Track' },
		{ key: 'album', type: 'Album', title: 'Spotify Album' },
		{ key: 'playlist', type: 'Playlist', title: 'Spotify Playlist' },
		{ key: 'artist', type: 'Artist', title: 'Spotify Artist' },
		{ key: 'show', type: 'Podcast', title: 'Spotify Podcast' },
		{ key: 'episode', type: 'Episode', title: 'Spotify Episode' }
	];

	for (const ct of contentTypes) {
		if (pathParts.includes(ct.key)) {
			const index = pathParts.indexOf(ct.key);
			spotifyId = pathParts[index + 1] || '';
			contentType = ct.type;
			title = ct.title;
			break;
		}
	}

	if (spotifyId) {
		description = `${contentType} ID: ${spotifyId.substring(0, 12)}...`;
	}

	const timestamp = urlObj.searchParams.get('t');
	if (timestamp) {
		const timeInSeconds = parseInt(timestamp);
		if (!isNaN(timeInSeconds)) {
			const minutes = Math.floor(timeInSeconds / 60);
			const seconds = timeInSeconds % 60;
			const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
			description = description ? `${description} • Starting at ${timeStr}` : `Starting at ${timeStr}`;
		}
	}

	return {
		platform: 'spotify',
		url,
		id: spotifyId,
		title,
		description,
		contentType,
		icon: '🎵',
		color: '#1DB954'
	};
}

function detectTwitter(url: string, urlObj: URL): LinkPreview {
	let tweetId = '';
	let contentType = 'Tweet';
	let title = 'X Post';
	let description;

	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('status')) {
		const statusIndex = pathParts.indexOf('status');
		const username = pathParts[statusIndex - 1];
		tweetId = pathParts[statusIndex + 1] || '';
		contentType = 'Tweet';
		title = 'Post';

		if (username) {
			description = `@${username}`;
		}

		if (tweetId) {
			description = description ? `${description} • Tweet ID: ${tweetId.substring(0, 8)}...` : `Tweet ID: ${tweetId.substring(0, 8)}...`;
		}
	} else if (pathParts.includes('i') && pathParts.includes('spaces')) {
		const spacesIndex = pathParts.indexOf('spaces');
		tweetId = pathParts[spacesIndex + 1] || '';
		contentType = 'Space';
		title = 'X Space';

		if (tweetId) {
			description = `Space ID: ${tweetId.substring(0, 8)}...`;
		}
	} else if (pathParts.includes('lists')) {
		const listsIndex = pathParts.indexOf('lists');
		const username = pathParts[listsIndex - 1];
		const listName = pathParts[listsIndex + 1];
		contentType = 'List';
		title = 'X List';

		if (username && listName) {
			description = `@${username}/${listName}`;
		}
	} else if (pathParts.length === 1 && pathParts[0] && !pathParts[0].startsWith('i')) {
		const username = pathParts[0];
		contentType = 'Profile';
		title = 'X Profile';
		description = `@${username}`;
	}

	return {
		platform: 'twitter',
		url,
		id: tweetId,
		title,
		description,
		contentType,
		icon: '🐦',
		color: '#1DA1F2'
	};
}

function detectGitHub(url: string, urlObj: URL): LinkPreview {
	let repoId = '';
	let contentType = 'Repository';
	let title = 'GitHub Repository';
	let description;

	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (isLegitimateHostname(urlObj.hostname, ['gist.github.com'])) {
		const username = pathParts[0];
		const gistId = pathParts[1] || '';
		contentType = 'Gist';
		title = 'GitHub Gist';

		if (username) {
			description = `@${username}`;
		}

		if (gistId) {
			description = description ? `${description} • Gist: ${gistId.substring(0, 8)}...` : `Gist: ${gistId.substring(0, 8)}...`;
		}

		repoId = gistId;
	} else if (pathParts.length >= 2) {
		const owner = pathParts[0];
		const repo = pathParts[1];
		repoId = `${owner}/${repo}`;

		if (pathParts.length === 2) {
			contentType = 'Repository';
			title = 'GitHub Repository';
			description = `${owner}/${repo}`;
		} else if (pathParts.includes('issues')) {
			const issuesIndex = pathParts.indexOf('issues');
			const issueNumber = pathParts[issuesIndex + 1];
			contentType = 'Issue';
			title = 'GitHub Issue';

			if (issueNumber) {
				description = `${owner}/${repo} #${issueNumber}`;
			} else {
				description = `${owner}/${repo} issues`;
			}
		} else if (pathParts.includes('pull')) {
			const pullIndex = pathParts.indexOf('pull');
			const prNumber = pathParts[pullIndex + 1];
			contentType = 'Pull Request';
			title = 'GitHub Pull Request';

			if (prNumber) {
				description = `${owner}/${repo} #${prNumber}`;
			} else {
				description = `${owner}/${repo} pulls`;
			}
		} else if (pathParts.includes('commit')) {
			const commitIndex = pathParts.indexOf('commit');
			const commitHash = pathParts[commitIndex + 1];
			contentType = 'Commit';
			title = 'GitHub Commit';

			if (commitHash) {
				description = `${owner}/${repo} ${commitHash.substring(0, 7)}`;
			} else {
				description = `${owner}/${repo}`;
			}
		} else if (pathParts.includes('releases')) {
			const releasesIndex = pathParts.indexOf('releases');
			if (pathParts[releasesIndex + 1] === 'tag') {
				const tag = pathParts[releasesIndex + 2];
				contentType = 'Release';
				title = 'GitHub Release';
				description = tag ? `${owner}/${repo} ${tag}` : `${owner}/${repo}`;
			} else {
				contentType = 'Releases';
				title = 'GitHub Releases';
				description = `${owner}/${repo}`;
			}
		} else if (pathParts.includes('tree') || pathParts.includes('blob')) {
			const type = pathParts.includes('tree') ? 'tree' : 'blob';
			const typeIndex = pathParts.indexOf(type);
			const branch = pathParts[typeIndex + 1];
			contentType = type === 'tree' ? 'Folder' : 'File';
			title = type === 'tree' ? 'GitHub Folder' : 'GitHub File';
			description = branch ? `${owner}/${repo}:${branch}` : `${owner}/${repo}`;
		} else {
			description = `${owner}/${repo}`;
		}
	} else if (pathParts.length === 1) {
		const username = pathParts[0];
		contentType = 'Profile';
		title = 'GitHub Profile';
		description = `@${username}`;
		repoId = username;
	}

	return {
		platform: 'github',
		url,
		id: repoId,
		title,
		description,
		contentType,
		icon: '🐙',
		color: '#24292f'
	};
}

function detectAmazon(url: string, urlObj: URL): LinkPreview {
	let productId = '';
	let contentType;
	let title;
	let description;

	const hostname = urlObj.hostname.toLowerCase();
	const countryMap: Record<string, string> = {
		'amazon.de': 'DE', 'amazon.co.uk': 'UK', 'amazon.fr': 'FR', 'amazon.it': 'IT',
		'amazon.es': 'ES', 'amazon.ca': 'CA', 'amazon.com.au': 'AU', 'amazon.co.jp': 'JP',
		'amazon.com': 'US'
	};
	const countryCode = Object.entries(countryMap).find(([domain]) => hostname.includes(domain))?.[1] || '';

	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.includes('dp') && pathParts.length > pathParts.indexOf('dp')) {
		const dpIndex = pathParts.indexOf('dp');
		productId = pathParts[dpIndex + 1] || '';
		contentType = 'Product';
		title = 'Amazon Product';

		if (productId) {
			description = countryCode ? `Product: ${productId} (${countryCode})` : `Product: ${productId}`;
		}
	} else if (pathParts.includes('gp') && pathParts.includes('product')) {
		const productIndex = pathParts.indexOf('product');
		productId = pathParts[productIndex + 1] || '';
		contentType = 'Product';
		title = 'Amazon Product';

		if (productId) {
			description = countryCode ? `Product: ${productId} (${countryCode})` : `Product: ${productId}`;
		}
	} else if (pathParts.includes('s') || urlObj.searchParams.get('k')) {
		const searchTerms = urlObj.searchParams.get('k');
		contentType = 'Search';
		title = 'Amazon Search';

		if (searchTerms) {
			description = countryCode ? `Search: "${decodeURIComponent(searchTerms.replace(/\+/g, ' '))}" (${countryCode})` : `Search: "${decodeURIComponent(searchTerms.replace(/\+/g, ' '))}"`;
		} else {
			description = countryCode ? `Search Results (${countryCode})` : 'Search Results';
		}
	} else if (pathParts.includes('stores')) {
		const storesIndex = pathParts.indexOf('stores');
		const storeName = pathParts[storesIndex + 1];
		contentType = 'Store';
		title = 'Amazon Store';

		if (storeName) {
			description = countryCode ? `Store: ${storeName} (${countryCode})` : `Store: ${storeName}`;
		}
	} else if (pathParts.includes('hz') && pathParts.includes('wishlist')) {
		const wishlistIndex = pathParts.findIndex(part => part.startsWith('ls'));
		const wishlistId = wishlistIndex !== -1 ? pathParts[wishlistIndex].replace('ls/', '') : '';
		contentType = 'Wishlist';
		title = 'Amazon Wishlist';

		if (wishlistId) {
			description = countryCode ? `Wishlist: ${wishlistId.substring(0, 8)}... (${countryCode})` : `Wishlist: ${wishlistId.substring(0, 8)}...`;
		}
	} else if (pathParts.includes('gp') && pathParts.includes('bestsellers')) {
		contentType = 'Bestsellers';
		title = 'Amazon Bestsellers';
		description = countryCode ? `Bestsellers (${countryCode})` : 'Bestsellers';
	} else if (pathParts.length >= 1 && pathParts[0] && !pathParts[0].includes('gp')) {
		const category = pathParts[0].replace(/-/g, ' ');
		contentType = 'Category';
		title = 'Amazon Category';
		description = countryCode ? `${category} (${countryCode})` : category;
	} else {
		contentType = 'Homepage';
		title = 'Amazon';
		description = countryCode ? `Amazon (${countryCode})` : 'Amazon';
	}

	return {
		platform: 'amazon',
		url,
		id: productId,
		title,
		description,
		contentType,
		icon: '📦',
		color: '#FF9900'
	};
}

function detectLhamacorp(url: string, urlObj: URL): LinkPreview {
	let contentType;
	let title;
	let description;

	const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

	if (pathParts.length === 0) {
		contentType = 'Homepage';
		title = 'LhamaCorp';
		description = 'LhamaCorp Homepage';
	} else {
		const path = pathParts.join('/');
		contentType = 'Page';
		title = 'LhamaCorp';
		description = `/${path}`;
	}

	return {
		platform: 'lhamacorp',
		url,
		title,
		description,
		contentType,
		icon: '🦙',
		color: '#0066CC'
	};
}