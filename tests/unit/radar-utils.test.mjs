import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	getXYFromLatitudeLongitudeMap,
	getXYFromLatitudeLongitudeDoppler,
	removeDopplerRadarImageNoise,
} from '../../server/scripts/modules/radar-utils.mjs';

// Helper: create a mock canvas context with pixel data
const createMockContext = (width, height, pixels) => {
	const data = new Uint8ClampedArray(pixels);
	const imageData = { data, width, height };
	let storedImageData = null;

	return {
		canvas: { width, height },
		getImageData: () => ({ ...imageData, data: new Uint8ClampedArray(data) }),
		putImageData: (imgData) => { storedImageData = imgData; },
		getStoredImageData: () => storedImageData,
	};
};

// Helper: pack RGBA values into an array
const rgba = (r, g, b, a = 255) => [r, g, b, a];

describe('getXYFromLatitudeLongitudeMap', () => {
	it('returns coordinates within tile bounds for continental US center', () => {
		const result = getXYFromLatitudeLongitudeMap({ latitude: 39.8, longitude: -98.5 });
		assert.ok(result.x >= 0, `x should be >= 0, got ${result.x}`);
		assert.ok(result.y >= 0, `y should be >= 0, got ${result.y}`);
	});

	it('clamps to 0 for far northwest positions', () => {
		const result = getXYFromLatitudeLongitudeMap({ latitude: 70, longitude: -170 });
		assert.equal(result.x, 0);
		assert.equal(result.y, 0);
	});

	it('returns different coordinates for different positions', () => {
		const seattle = getXYFromLatitudeLongitudeMap({ latitude: 47.6, longitude: -122.3 });
		const miami = getXYFromLatitudeLongitudeMap({ latitude: 25.8, longitude: -80.2 });

		assert.ok(miami.x > seattle.x, 'Miami should be to the right of Seattle');
		assert.ok(miami.y > seattle.y, 'Miami should be below Seattle');
	});
});

describe('getXYFromLatitudeLongitudeDoppler', () => {
	it('returns coordinates for a given position with offsets', () => {
		const result = getXYFromLatitudeLongitudeDoppler(
			{ latitude: 39.8, longitude: -98.5 },
			0,
			0,
		);
		assert.ok(result.x >= 0, `x should be >= 0, got ${result.x}`);
		assert.ok(result.y >= 0, `y should be >= 0, got ${result.y}`);
	});

	it('offsets shift the result', () => {
		const base = getXYFromLatitudeLongitudeDoppler(
			{ latitude: 39.8, longitude: -98.5 },
			0,
			0,
		);
		const shifted = getXYFromLatitudeLongitudeDoppler(
			{ latitude: 39.8, longitude: -98.5 },
			100,
			50,
		);

		assert.ok(shifted.x < base.x || shifted.x === 0, 'x offset should decrease x');
		assert.ok(shifted.y < base.y || shifted.y === 0, 'y offset should decrease y');
	});

	it('returns values consistent with 2x scale factor', () => {
		// The function computes raw values then multiplies by 2.
		// Verify by checking two nearby points produce a proportional difference.
		const pos1 = { latitude: 40, longitude: -100 };
		const pos2 = { latitude: 40, longitude: -99 };
		const r1 = getXYFromLatitudeLongitudeDoppler(pos1, 0, 0);
		const r2 = getXYFromLatitudeLongitudeDoppler(pos2, 0, 0);

		// 1 degree of longitude at this scale ~= 42.1768 * 2 ~= 84.35 pixels
		const xDiff = Math.abs(r2.x - r1.x);
		assert.ok(xDiff > 80 && xDiff < 90, `Expected ~84px difference, got ${xDiff}`);
	});
});

describe('removeDopplerRadarImageNoise', () => {
	it('makes black pixels transparent', () => {
		const ctx = createMockContext(1, 1, [...rgba(0, 0, 0, 255)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(0, 0, 0, 0)]);
	});

	it('makes cyan (0,236,236) transparent', () => {
		const ctx = createMockContext(1, 1, [...rgba(0, 236, 236, 255)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(0, 0, 0, 0)]);
	});

	it('makes light blue (1,160,246) transparent', () => {
		const ctx = createMockContext(1, 1, [...rgba(1, 160, 246, 255)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(0, 0, 0, 0)]);
	});

	it('makes blue (0,0,246) transparent', () => {
		const ctx = createMockContext(1, 1, [...rgba(0, 0, 246, 255)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(0, 0, 0, 0)]);
	});

	it('remaps bright green (0,255,0) to muted green', () => {
		const ctx = createMockContext(1, 1, [...rgba(0, 255, 0)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(49, 210, 22, 255)]);
	});

	it('remaps medium green (0,200,0) to darker green', () => {
		const ctx = createMockContext(1, 1, [...rgba(0, 200, 0)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(0, 142, 0, 255)]);
	});

	it('remaps dark green (0,144,0) to very dark green', () => {
		const ctx = createMockContext(1, 1, [...rgba(0, 144, 0)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(20, 90, 15, 255)]);
	});

	it('remaps yellow (255,255,0) to near-black green', () => {
		const ctx = createMockContext(1, 1, [...rgba(255, 255, 0)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(10, 40, 10, 255)]);
	});

	it('remaps warm yellow (231,192,0) to muted yellow', () => {
		const ctx = createMockContext(1, 1, [...rgba(231, 192, 0)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(196, 179, 70, 255)]);
	});

	it('remaps orange (255,144,0) to dark orange', () => {
		const ctx = createMockContext(1, 1, [...rgba(255, 144, 0)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(190, 72, 19, 255)]);
	});

	it('remaps red shades (214,0,0) and (255,0,0) to dark red', () => {
		const ctx1 = createMockContext(1, 1, [...rgba(214, 0, 0)]);
		removeDopplerRadarImageNoise(ctx1);
		assert.deepEqual([...ctx1.getStoredImageData().data], [...rgba(171, 14, 14, 255)]);

		const ctx2 = createMockContext(1, 1, [...rgba(255, 0, 0)]);
		removeDopplerRadarImageNoise(ctx2);
		assert.deepEqual([...ctx2.getStoredImageData().data], [...rgba(171, 14, 14, 255)]);
	});

	it('remaps brown shades (192,0,0) and (255,0,255) to brown', () => {
		const ctx1 = createMockContext(1, 1, [...rgba(192, 0, 0)]);
		removeDopplerRadarImageNoise(ctx1);
		assert.deepEqual([...ctx1.getStoredImageData().data], [...rgba(115, 31, 4, 255)]);

		const ctx2 = createMockContext(1, 1, [...rgba(255, 0, 255)]);
		removeDopplerRadarImageNoise(ctx2);
		assert.deepEqual([...ctx2.getStoredImageData().data], [...rgba(115, 31, 4, 255)]);
	});

	it('leaves unrecognized colors unchanged', () => {
		const ctx = createMockContext(1, 1, [...rgba(128, 128, 128, 200)]);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data], [...rgba(128, 128, 128, 200)]);
	});

	it('handles multiple pixels in sequence', () => {
		const pixels = [
			...rgba(0, 0, 0, 255),       // -> transparent
			...rgba(0, 255, 0, 255),      // -> muted green
			...rgba(128, 128, 128, 200),  // -> unchanged
		];
		const ctx = createMockContext(3, 1, pixels);
		removeDopplerRadarImageNoise(ctx);

		const result = ctx.getStoredImageData();
		assert.deepEqual([...result.data.slice(0, 4)], [...rgba(0, 0, 0, 0)]);
		assert.deepEqual([...result.data.slice(4, 8)], [...rgba(49, 210, 22, 255)]);
		assert.deepEqual([...result.data.slice(8, 12)], [...rgba(128, 128, 128, 200)]);
	});

	it('handles null context gracefully', () => {
		assert.doesNotThrow(() => removeDopplerRadarImageNoise(null));
	});

	it('handles context with missing canvas gracefully', () => {
		assert.doesNotThrow(() => removeDopplerRadarImageNoise({}));
	});

	it('handles zero-dimension canvas gracefully', () => {
		const ctx = { canvas: { width: 0, height: 0 } };
		assert.doesNotThrow(() => removeDopplerRadarImageNoise(ctx));
	});
});
