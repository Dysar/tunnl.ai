// Small, testable helpers that mirror background.js logic

function normalizeHostname(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function lookupKnownCategory(url, knownMap) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        const normalized = hostname.replace(/^www\./, '');
        const withWww = `www.${normalized}`;
        return knownMap[hostname]
            || knownMap[normalized]
            || knownMap[withWww]
            || null;
    } catch {
        return null;
    }
}

function buildCacheKey({ useCategories, url, selectedCategories = [], taskText = '' }) {
    const host = normalizeHostname(url);
    if (useCategories) {
        const categoriesKey = selectedCategories.join(',');
        return `host:${host}||categories:${categoriesKey}`;
    } else {
        return `host:${host}||task:${taskText || ''}`;
    }
}

module.exports = {
    normalizeHostname,
    lookupKnownCategory,
    buildCacheKey
};


