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
// Attach to global for service worker/browser
try {
    if (typeof self !== 'undefined') {
        self.normalizeHostname = normalizeHostname;
        self.lookupKnownCategory = lookupKnownCategory;
        self.buildCacheKey = buildCacheKey;
    } else if (typeof window !== 'undefined') {
        window.normalizeHostname = normalizeHostname;
        window.lookupKnownCategory = lookupKnownCategory;
        window.buildCacheKey = buildCacheKey;
    }
} catch {}

// Node.js export for tests (guarded)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeHostname,
        lookupKnownCategory,
        buildCacheKey
    };
}


