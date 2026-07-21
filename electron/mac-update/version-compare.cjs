function compareVersions(a, b) {
	const partsA = a.split('.').map(Number);
	const partsB = b.split('.').map(Number);
	const len = Math.max(partsA.length, partsB.length);

	for (let i = 0; i < len; i++) {
		const numA = partsA[i] || 0;
		const numB = partsB[i] || 0;
		if (numA !== numB) return numA < numB ? -1 : 1;
	}

	return 0;
}

module.exports = { compareVersions };
