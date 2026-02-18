// Web Worker for radar image processing
// Runs pixel manipulation off the main thread to keep the UI responsive

// Import the pure data functions
import { removeDopplerRadarImageNoiseData, mergeDopplerRadarImageData } from './radar-utils.mjs';

self.addEventListener('message', (e) => {
	const { type, id, radarData, mapData, width, height } = e.data;

	if (type === 'processRadar') {
		// Step 1: Remove noise from radar image (recolor pixels)
		removeDopplerRadarImageNoiseData(radarData);

		// Step 2: Merge radar with map (mask dark map areas)
		mergeDopplerRadarImageData(mapData, radarData);

		// Post the result back, transferring the buffer for zero-copy
		self.postMessage(
			{ type: 'result', id, processedData: radarData, width, height },
			[radarData.buffer],
		);
	}
});
