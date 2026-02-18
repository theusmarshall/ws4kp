import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import the pure data functions and coordinate functions
import {
	removeDopplerRadarImageNoiseData,
	mergeDopplerRadarImageData,
	getXYFromLatitudeLongitudeMap,
	getXYFromLatitudeLongitudeDoppler,
} from '../../server/scripts/modules/radar-utils.mjs';

// Helper: create a pixel (4 bytes) in a Uint8ClampedArray
const makePixelData = (pixels) => {
	const data = new Uint8ClampedArray(pixels.length * 4);
	pixels.forEach(([r, g, b, a], idx) => {
		data[idx * 4] = r;
		data[idx * 4 + 1] = g;
		data[idx * 4 + 2] = b;
		data[idx * 4 + 3] = a;
	});
	return data;
};

// Helper: read a pixel from a Uint8ClampedArray
const readPixel = (data, idx) => [data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2], data[idx * 4 + 3]];

describe('removeDopplerRadarImageNoiseData', () => {
	it('should make black pixels transparent', () => {
		const data = makePixelData([[0, 0, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [0, 0, 0, 0]);
	});

	it('should make cyan (0,236,236) transparent', () => {
		const data = makePixelData([[0, 236, 236, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [0, 0, 0, 0]);
	});

	it('should make light blue (1,160,246) transparent', () => {
		const data = makePixelData([[1, 160, 246, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [0, 0, 0, 0]);
	});

	it('should make blue (0,0,246) transparent', () => {
		const data = makePixelData([[0, 0, 246, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [0, 0, 0, 0]);
	});

	it('should remap bright green (0,255,0) to light green', () => {
		const data = makePixelData([[0, 255, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [49, 210, 22, 255]);
	});

	it('should remap green (0,200,0) to medium green', () => {
		const data = makePixelData([[0, 200, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [0, 142, 0, 255]);
	});

	it('should remap dark green (0,144,0)', () => {
		const data = makePixelData([[0, 144, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [20, 90, 15, 255]);
	});

	it('should remap yellow (255,255,0) to dark green', () => {
		const data = makePixelData([[255, 255, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [10, 40, 10, 255]);
	});

	it('should remap (231,192,0) to yellow', () => {
		const data = makePixelData([[231, 192, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [196, 179, 70, 255]);
	});

	it('should remap orange (255,144,0)', () => {
		const data = makePixelData([[255, 144, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [190, 72, 19, 255]);
	});

	it('should remap dark red (214,0,0) to red', () => {
		const data = makePixelData([[214, 0, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [171, 14, 14, 255]);
	});

	it('should remap bright red (255,0,0) to red', () => {
		const data = makePixelData([[255, 0, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [171, 14, 14, 255]);
	});

	it('should remap (192,0,0) to brown', () => {
		const data = makePixelData([[192, 0, 0, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [115, 31, 4, 255]);
	});

	it('should remap magenta (255,0,255) to brown', () => {
		const data = makePixelData([[255, 0, 255, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [115, 31, 4, 255]);
	});

	it('should not modify unrecognized colors', () => {
		const data = makePixelData([[128, 128, 128, 255]]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [128, 128, 128, 255]);
	});

	it('should process multiple pixels correctly', () => {
		const data = makePixelData([
			[0, 0, 0, 255],      // -> transparent
			[0, 255, 0, 255],    // -> light green
			[128, 128, 128, 255], // -> unchanged
		]);
		removeDopplerRadarImageNoiseData(data);
		assert.deepEqual(readPixel(data, 0), [0, 0, 0, 0]);
		assert.deepEqual(readPixel(data, 1), [49, 210, 22, 255]);
		assert.deepEqual(readPixel(data, 2), [128, 128, 128, 255]);
	});
});

describe('mergeDopplerRadarImageData', () => {
	it('should make radar pixels transparent where map is dark', () => {
		const mapData = makePixelData([[50, 50, 50, 255]]);   // dark pixel
		const radarData = makePixelData([[255, 0, 0, 255]]);  // red radar pixel
		mergeDopplerRadarImageData(mapData, radarData);
		assert.deepEqual(readPixel(radarData, 0), [0, 0, 0, 0], 'Radar pixel should be transparent');
	});

	it('should preserve radar pixels where map is bright', () => {
		const mapData = makePixelData([[200, 200, 200, 255]]);  // bright pixel
		const radarData = makePixelData([[255, 0, 0, 255]]);    // red radar pixel
		mergeDopplerRadarImageData(mapData, radarData);
		assert.deepEqual(readPixel(radarData, 0), [255, 0, 0, 255], 'Radar pixel should be preserved');
	});

	it('should handle the boundary at 116', () => {
		// All channels at 115 -> dark (should mask)
		const mapData1 = makePixelData([[115, 115, 115, 255]]);
		const radarData1 = makePixelData([[100, 200, 50, 255]]);
		mergeDopplerRadarImageData(mapData1, radarData1);
		assert.deepEqual(readPixel(radarData1, 0), [0, 0, 0, 0], 'Should mask at 115');

		// One channel at 116 -> not dark (should keep)
		const mapData2 = makePixelData([[116, 50, 50, 255]]);
		const radarData2 = makePixelData([[100, 200, 50, 255]]);
		mergeDopplerRadarImageData(mapData2, radarData2);
		assert.deepEqual(readPixel(radarData2, 0), [100, 200, 50, 255], 'Should preserve when R=116');
	});

	it('should process multiple pixels', () => {
		const mapData = makePixelData([
			[10, 10, 10, 255],    // dark
			[200, 200, 200, 255], // bright
		]);
		const radarData = makePixelData([
			[255, 0, 0, 255],
			[0, 255, 0, 255],
		]);
		mergeDopplerRadarImageData(mapData, radarData);
		assert.deepEqual(readPixel(radarData, 0), [0, 0, 0, 0], 'First pixel should be masked');
		assert.deepEqual(readPixel(radarData, 1), [0, 255, 0, 255], 'Second pixel should be preserved');
	});
});

describe('getXYFromLatitudeLongitudeMap', () => {
	it('should return coordinates for a known US location', () => {
		// Chicago: lat ~41.88, lon ~-87.63
		const pos = { latitude: 41.88, longitude: -87.63 };
		const result = getXYFromLatitudeLongitudeMap(pos, 240, 138);
		assert.equal(typeof result.x, 'number');
		assert.equal(typeof result.y, 'number');
		assert.ok(result.x >= 0, 'x should be non-negative');
		assert.ok(result.y >= 0, 'y should be non-negative');
	});

	it('should clamp coordinates to valid bounds', () => {
		// Far north-west: should clamp to 0,0
		const pos = { latitude: 60, longitude: -140 };
		const result = getXYFromLatitudeLongitudeMap(pos, 240, 138);
		assert.ok(result.x >= 0, 'x should be clamped to >= 0');
		assert.ok(result.y >= 0, 'y should be clamped to >= 0');
	});

	it('should return consistent results for same input', () => {
		const pos = { latitude: 40, longitude: -100 };
		const a = getXYFromLatitudeLongitudeMap(pos, 240, 138);
		const b = getXYFromLatitudeLongitudeMap(pos, 240, 138);
		assert.deepEqual(a, b, 'Should be deterministic');
	});
});

describe('getXYFromLatitudeLongitudeDoppler', () => {
	it('should return coordinates for a known US location', () => {
		const pos = { latitude: 41.88, longitude: -87.63 };
		const result = getXYFromLatitudeLongitudeDoppler(pos, 240, 138);
		assert.equal(typeof result.x, 'number');
		assert.equal(typeof result.y, 'number');
		assert.ok(result.x >= 0, 'x should be non-negative');
		assert.ok(result.y >= 0, 'y should be non-negative');
	});

	it('should clamp coordinates to valid bounds', () => {
		const pos = { latitude: 60, longitude: -140 };
		const result = getXYFromLatitudeLongitudeDoppler(pos, 240, 138);
		assert.ok(result.x >= 0, 'x should be clamped to >= 0');
		assert.ok(result.y >= 0, 'y should be clamped to >= 0');
	});

	it('should produce different results from map variant', () => {
		const pos = { latitude: 40, longitude: -100 };
		const mapResult = getXYFromLatitudeLongitudeMap(pos, 240, 138);
		const dopplerResult = getXYFromLatitudeLongitudeDoppler(pos, 240, 138);
		// They use different scaling so should differ
		assert.notDeepEqual(mapResult, dopplerResult, 'Map and Doppler should use different projections');
	});
});
