import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('mp3 filter regex', () => {
	const mp3Filter = (file) => file.match(/\.mp3$/);

	it('matches .mp3 files', () => {
		assert.ok(mp3Filter('song.mp3'));
		assert.ok(mp3Filter('Trammell Starks - After Midnight.mp3'));
	});

	it('rejects non-mp3 files', () => {
		assert.equal(mp3Filter('readme.txt'), null);
		assert.equal(mp3Filter('image.png'), null);
		assert.equal(mp3Filter('.gitkeep'), null);
	});

	it('rejects files with mp3 in the name but wrong extension', () => {
		assert.equal(mp3Filter('mp3-notes.txt'), null);
		assert.equal(mp3Filter('song.mp3.bak'), null);
	});

	it('rejects directory names', () => {
		assert.equal(mp3Filter('default'), null);
	});
});

describe('playlist-reader integration', () => {
	it('returns mp3 files from server/music directory', async () => {
		const reader = (await import('../../src/playlist-reader.mjs')).default;
		const files = await reader();

		assert.ok(Array.isArray(files));
		assert.ok(files.length > 0, 'Expected at least one mp3 file');

		for (const file of files) {
			assert.match(file, /\.mp3$/, `Expected mp3 file, got: ${file}`);
		}
	});

	it('does not include non-mp3 files', async () => {
		const reader = (await import('../../src/playlist-reader.mjs')).default;
		const files = await reader();

		const nonMp3 = files.filter((f) => !f.match(/\.mp3$/));
		assert.equal(nonMp3.length, 0, `Found non-mp3 files: ${nonMp3.join(', ')}`);
	});
});
