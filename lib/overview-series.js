export const PERIOD_DAYS = 30;

// Change of a count in percent, or of a rate in percentage points. Null when there's nothing to compare.
export function compareCount(current, previous) {
	if (!previous) return null;
	return ((current - previous) / previous) * 100;
}

export function compareRate(part, total, previousPart, previousTotal) {
	if (!total || !previousTotal) return null;
	return ((part / total) - (previousPart / previousTotal)) * 100;
}
