const assert = require('assert');
const { normalizeHostname, buildOriginNormalizedUrl, lookupKnownCategory, buildCacheKey } = require('../url-analysis/url-utils');

(function testNormalizeHostname() {
    assert.strictEqual(normalizeHostname('https://www.Example.com/path'), 'example.com');
    assert.strictEqual(normalizeHostname('https://example.com'), 'example.com');
    assert.strictEqual(normalizeHostname('http://WWW.SUB.EXAMPLE.com'), 'sub.example.com');
    assert.strictEqual(normalizeHostname('not-a-url'), '');
})();

(function testBuildOriginNormalizedUrl() {
    assert.strictEqual(buildOriginNormalizedUrl('https://www.Example.com/path?a=1#x'), 'https://example.com');
    assert.strictEqual(buildOriginNormalizedUrl('http://WWW.SUB.EXAMPLE.com:8080/a/b'), 'http://sub.example.com:8080');
})();

(function testLookupKnownCategory() {
    const map = {
        'facebook.com': 'social-media',
        'www.youtube.com': 'social-media',
        'example.org': 'news'
    };
    assert.strictEqual(lookupKnownCategory('https://facebook.com', map), 'social-media');
    assert.strictEqual(lookupKnownCategory('https://www.facebook.com', map), 'social-media');
    assert.strictEqual(lookupKnownCategory('https://youtube.com', map), 'social-media');
    assert.strictEqual(lookupKnownCategory('https://www.youtube.com', map), 'social-media');
    assert.strictEqual(lookupKnownCategory('https://example.org/a', map), 'news');
    assert.strictEqual(lookupKnownCategory('https://sub.example.org', map), null);
    assert.strictEqual(lookupKnownCategory('bad url', map), null);
})();

(function testBuildCacheKey() {
    const url = 'https://www.Example.com/page?a=1';
    const hostKey = 'host:example.com';

    const k1 = buildCacheKey({ useCategories: true, url, selectedCategories: ['news','gaming'] });
    assert.strictEqual(k1, `${hostKey}||categories:news,gaming`);

    const k2 = buildCacheKey({ useCategories: false, url, taskText: 'research bananas' });
    assert.strictEqual(k2, `${hostKey}||task:research bananas`);

    const k3 = buildCacheKey({ useCategories: false, url });
    assert.strictEqual(k3, `${hostKey}||task:`);
})();

console.log('All url-utils tests passed.');


