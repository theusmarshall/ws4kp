import { describe, it, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';

// HttpCache is exported as a singleton, so we import the module and access
// the class constructor through it for static method testing.
import cache from '../../proxy/cache.mjs';

const HttpCache = cache.constructor;

// Tear down the singleton's cleanup interval so Node can exit cleanly
after(() => {
	cache.destroy();
});

describe('HttpCache.parseCacheControl', () => {
	it('returns 0 for null/undefined input', () => {
		assert.equal(HttpCache.parseCacheControl(null), 0);
		assert.equal(HttpCache.parseCacheControl(undefined), 0);
		assert.equal(HttpCache.parseCacheControl(''), 0);
	});

	it('extracts max-age value', () => {
		assert.equal(HttpCache.parseCacheControl('max-age=300'), 300);
		assert.equal(HttpCache.parseCacheControl('public, max-age=600'), 600);
	});

	it('prefers s-maxage over max-age', () => {
		assert.equal(HttpCache.parseCacheControl('s-maxage=120, max-age=600'), 120);
	});

	it('extracts s-maxage when present alone', () => {
		assert.equal(HttpCache.parseCacheControl('s-maxage=3600'), 3600);
	});

	it('returns 0 for no-cache directives', () => {
		assert.equal(HttpCache.parseCacheControl('no-cache'), 0);
		assert.equal(HttpCache.parseCacheControl('no-store'), 0);
	});

	it('is case-insensitive', () => {
		assert.equal(HttpCache.parseCacheControl('Max-Age=120'), 120);
		assert.equal(HttpCache.parseCacheControl('S-MAXAGE=60'), 60);
	});
});

describe('HttpCache.generateKey', () => {
	it('generates key from path when no query string', () => {
		const req = { path: '/api/points/42,-90', url: '/api/points/42,-90' };
		const key = HttpCache.generateKey(req);
		assert.equal(key, '/api/points/42,-90');
	});

	it('includes query string in key', () => {
		const req = { path: '/api/points/42,-90', url: '/api/points/42,-90?units=us' };
		const key = HttpCache.generateKey(req);
		assert.equal(key, '/api/points/42,-90?units=us');
	});

	it('uses path as fallback when url is missing', () => {
		const req = { path: '/api/forecast' };
		const key = HttpCache.generateKey(req);
		assert.equal(key, '/api/forecast');
	});

	it('uses url as fallback when path is missing', () => {
		// When path is missing, url is used for both path and url,
		// so query string gets appended again
		const req = { url: '/api/forecast?a=1' };
		const key = HttpCache.generateKey(req);
		assert.equal(key, '/api/forecast?a=1?a=1');
	});

	it('defaults to / when both are missing', () => {
		const req = {};
		const key = HttpCache.generateKey(req);
		assert.equal(key, '/');
	});
});

describe('HttpCache.setFilteredHeaders', () => {
	it('strips cache-related headers and sets proxy cache policy', () => {
		const headersSet = {};
		const res = {
			header(name, value) { headersSet[name] = value; },
		};

		HttpCache.setFilteredHeaders(res, {
			'content-type': 'application/json',
			'cache-control': 'max-age=600',
			etag: '"abc123"',
			'last-modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
			expires: 'Thu, 01 Jan 2099 00:00:00 GMT',
			'x-custom': 'value',
		});

		assert.equal(headersSet['content-type'], 'application/json');
		assert.equal(headersSet['x-custom'], 'value');
		assert.equal(headersSet['cache-control'], 'public, max-age=30');
		assert.equal(headersSet.etag, undefined);
		assert.equal(headersSet['last-modified'], undefined);
		assert.equal(headersSet.expires, undefined);
	});

	it('handles null/undefined headers gracefully', () => {
		const headersSet = {};
		const res = { header(name, value) { headersSet[name] = value; } };

		HttpCache.setFilteredHeaders(res, null);
		assert.equal(headersSet['cache-control'], 'public, max-age=30');
	});
});

describe('HttpCache.calculateHeuristicMaxAge', () => {
	it('returns 0 for future dates', () => {
		const future = new Date(Date.now() + 3600 * 1000).toUTCString();
		assert.equal(HttpCache.calculateHeuristicMaxAge(future), 0);
	});

	it('clamps to minimum of 1 hour for recent resources', () => {
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toUTCString();
		assert.equal(HttpCache.calculateHeuristicMaxAge(tenMinutesAgo), 3600);
	});

	it('uses 10% of age for mid-range resources', () => {
		const twentyHoursAgo = new Date(Date.now() - 20 * 3600 * 1000).toUTCString();
		const result = HttpCache.calculateHeuristicMaxAge(twentyHoursAgo);
		// 20 hours = 72000s, 10% = 7200s = 2 hours, within [1h, 4h]
		assert.equal(result, 7200);
	});

	it('clamps to maximum of 4 hours for old resources', () => {
		const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toUTCString();
		assert.equal(HttpCache.calculateHeuristicMaxAge(oneWeekAgo), 4 * 3600);
	});

	it('returns NaN for invalid date strings (Date constructor does not throw)', () => {
		const result = HttpCache.calculateHeuristicMaxAge('not-a-date');
		assert.ok(Number.isNaN(result));
	});
});

describe('HttpCache instance - cache state transitions', () => {
	let testCache;

	beforeEach(() => {
		testCache = new HttpCache();
		// Stop the cleanup interval to avoid interference
		if (testCache.cleanupInterval) {
			clearInterval(testCache.cleanupInterval);
			testCache.cleanupInterval = null;
		}
	});

	afterEach(() => {
		if (testCache.cleanupInterval) {
			clearInterval(testCache.cleanupInterval);
		}
	});

	it('returns miss for unknown keys', () => {
		const req = { path: '/api/test', url: '/api/test' };
		const result = testCache.getCachedRequest(req);
		assert.equal(result.status, 'miss');
		assert.equal(result.data, null);
	});

	it('returns fresh for non-expired entries', () => {
		const req = { path: '/api/test', url: '/api/test' };
		const key = HttpCache.generateKey(req);

		testCache.cache.set(key, {
			statusCode: 200,
			headers: { 'content-type': 'application/json' },
			data: '{"ok":true}',
			expiry: Date.now() + 60000,
			timestamp: Date.now(),
			url: 'https://api.weather.gov/api/test',
		});

		const result = testCache.getCachedRequest(req);
		assert.equal(result.status, 'fresh');
		assert.equal(result.data.statusCode, 200);
	});

	it('returns stale for expired entries', () => {
		const req = { path: '/api/test', url: '/api/test' };
		const key = HttpCache.generateKey(req);

		testCache.cache.set(key, {
			statusCode: 200,
			headers: { 'content-type': 'application/json' },
			data: '{"ok":true}',
			expiry: Date.now() - 1000,
			timestamp: Date.now() - 61000,
			url: 'https://api.weather.gov/api/test',
		});

		const result = testCache.getCachedRequest(req);
		assert.equal(result.status, 'stale');
		assert.equal(result.data.statusCode, 200);
	});

	it('storeCachedResponse stores entry with explicit TTL', () => {
		const req = { path: '/api/test', url: '/api/test' };
		const response = { statusCode: 200, headers: {}, data: '{"ok":true}' };
		const originalHeaders = { 'cache-control': 'max-age=300' };

		testCache.storeCachedResponse(req, response, 'https://api.weather.gov/api/test', originalHeaders);

		const key = HttpCache.generateKey(req);
		const cached = testCache.cache.get(key);
		assert.ok(cached);
		assert.equal(cached.statusCode, 200);
		assert.ok(cached.expiry > Date.now());
		assert.ok(cached.expiry <= Date.now() + 300 * 1000 + 100);
	});

	it('storeCachedResponse does not cache when no cache directives', () => {
		const req = { path: '/api/nocache', url: '/api/nocache' };
		const response = { statusCode: 200, headers: {}, data: '{}' };

		testCache.storeCachedResponse(req, response, 'https://api.weather.gov/api/nocache', {});

		const key = HttpCache.generateKey(req);
		assert.equal(testCache.cache.has(key), false);
	});

	it('getStats returns correct counts', () => {
		const now = Date.now();
		testCache.cache.set('valid', { expiry: now + 60000 });
		testCache.cache.set('expired', { expiry: now - 1000 });

		const stats = testCache.getStats();
		assert.equal(stats.total, 2);
		assert.equal(stats.valid, 1);
		assert.equal(stats.expired, 1);
		assert.equal(stats.inFlight, 0);
	});

	it('clearEntry removes a specific entry', () => {
		testCache.cache.set('/api/test', { data: 'test' });
		assert.equal(testCache.cache.size, 1);

		const result = testCache.clearEntry('/api/test');
		assert.equal(result, true);
		assert.equal(testCache.cache.size, 0);
	});

	it('clearEntry returns false for missing entry', () => {
		const result = testCache.clearEntry('/api/nonexistent');
		assert.equal(result, false);
	});
});
