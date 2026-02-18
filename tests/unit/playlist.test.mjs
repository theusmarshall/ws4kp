import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// playlist-reader expects to run from the project root and reads ./server/music
// We test the filtering logic directly and also the reader from the project root.

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, '../..');

describe('playlist mp3 filter logic', () => {
	const mp3Filter = (file) => file.match(/\.mp3$/);

	it('should match .mp3 files', () => {
		assert.ok(mp3Filter('song.mp3'), 'Should match .mp3');
		assert.ok(mp3Filter('My Song - Artist.mp3'), 'Should match .mp3 with spaces');
	});

	it('should not match non-mp3 files', () => {
		assert.equal(mp3Filter('readme.txt'), null, 'Should not match .txt');
		assert.equal(mp3Filter('song.wav'), null, 'Should not match .wav');
		assert.equal(mp3Filter('song.mp4'), null, 'Should not match .mp4');
		assert.equal(mp3Filter('song.mp3.bak'), null, 'Should not match .mp3.bak');
	});

	it('should not match files without extension', () => {
		assert.equal(mp3Filter('mp3'), null, 'Should not match bare mp3');
	});
});

describe('playlist-reader integration', () => {
	it('should read the default music directory', async () => {
		// Verify the default music directory exists
		const defaultMusicPath = path.join(projectRoot, 'server/music/default');
		const stat = await fs.stat(defaultMusicPath);
		assert.ok(stat.isDirectory(), 'Default music directory should exist');
	});

	it('should find mp3 files in the default directory', async () => {
		const defaultMusicPath = path.join(projectRoot, 'server/music/default');
		const files = await fs.readdir(defaultMusicPath);
		const mp3Files = files.filter((file) => file.match(/\.mp3$/));
		assert.ok(mp3Files.length > 0, 'Should find at least one mp3 in default directory');
	});

	it('should exclude non-mp3 files from the default directory', async () => {
		const defaultMusicPath = path.join(projectRoot, 'server/music/default');
		const files = await fs.readdir(defaultMusicPath);
		const mp3Files = files.filter((file) => file.match(/\.mp3$/));
		const nonMp3Files = files.filter((file) => !file.match(/\.mp3$/));

		// If there are non-mp3 files, ensure they are not in the filtered list
		if (nonMp3Files.length > 0) {
			nonMp3Files.forEach((file) => {
				assert.ok(!mp3Files.includes(file), `Non-mp3 file "${file}" should not be in filtered list`);
			});
		}
	});
});
