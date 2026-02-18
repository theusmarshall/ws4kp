const getXYFromLatitudeLongitudeMap = (pos, offsetX, offsetY) => {
	let y = 0;
	let x = 0;
	const imgHeight = 3200;
	const imgWidth = 5100;

	y = (51.75 - pos.latitude) * 55.2;
	// center map
	y -= offsetY;

	// Do not allow the map to exceed the max/min coordinates.
	if (y > (imgHeight - (offsetY * 2))) {
		y = imgHeight - (offsetY * 2);
	} else if (y < 0) {
		y = 0;
	}

	x = ((-130.37 - pos.longitude) * 41.775) * -1;
	// center map
	x -= offsetX;

	// Do not allow the map to exceed the max/min coordinates.
	if (x > (imgWidth - (offsetX * 2))) {
		x = imgWidth - (offsetX * 2);
	} else if (x < 0) {
		x = 0;
	}

	return { x: x * 2, y: y * 2 };
};

const getXYFromLatitudeLongitudeDoppler = (pos, offsetX, offsetY) => {
	let y = 0;
	let x = 0;
	const imgHeight = 6000;
	const imgWidth = 2800;

	y = (51 - pos.latitude) * 61.4481;
	// center map
	y -= offsetY;

	// Do not allow the map to exceed the max/min coordinates.
	if (y > (imgHeight - (offsetY * 2))) {
		y = imgHeight - (offsetY * 2);
	} else if (y < 0) {
		y = 0;
	}

	x = ((-129.138 - pos.longitude) * 42.1768) * -1;
	// center map
	x -= offsetX;

	// Do not allow the map to exceed the max/min coordinates.
	if (x > (imgWidth - (offsetX * 2))) {
		x = imgWidth - (offsetX * 2);
	} else if (x < 0) {
		x = 0;
	}

	return { x: x * 2, y: y * 2 };
};

// Pure data version: operates on a Uint8ClampedArray directly
// Can be used in both main thread and Web Worker
const removeDopplerRadarImageNoiseData = (data) => {
	for (let i = 0; i < data.length; i += 4) {
		let R = data[i];
		let G = data[i + 1];
		let B = data[i + 2];
		let A = data[i + 3];

		if ((R === 0 && G === 0 && B === 0)
					|| (R === 0 && G === 236 && B === 236)
					|| (R === 1 && G === 160 && B === 246)
					|| (R === 0 && G === 0 && B === 246)) {
			// Transparent
			R = 0;
			G = 0;
			B = 0;
			A = 0;
		} else if ((R === 0 && G === 255 && B === 0)) {
			// Light Green 1
			R = 49;
			G = 210;
			B = 22;
			A = 255;
		} else if ((R === 0 && G === 200 && B === 0)) {
			// Light Green 2
			R = 0;
			G = 142;
			B = 0;
			A = 255;
		} else if ((R === 0 && G === 144 && B === 0)) {
			// Dark Green 1
			R = 20;
			G = 90;
			B = 15;
			A = 255;
		} else if ((R === 255 && G === 255 && B === 0)) {
			// Dark Green 2
			R = 10;
			G = 40;
			B = 10;
			A = 255;
		} else if ((R === 231 && G === 192 && B === 0)) {
			// Yellow
			R = 196;
			G = 179;
			B = 70;
			A = 255;
		} else if ((R === 255 && G === 144 && B === 0)) {
			// Orange
			R = 190;
			G = 72;
			B = 19;
			A = 255;
		} else if ((R === 214 && G === 0 && B === 0)
					|| (R === 255 && G === 0 && B === 0)) {
			// Red
			R = 171;
			G = 14;
			B = 14;
			A = 255;
		} else if ((R === 192 && G === 0 && B === 0)
					|| (R === 255 && G === 0 && B === 255)) {
			// Brown
			R = 115;
			G = 31;
			B = 4;
			A = 255;
		}

		data[i] = R;
		data[i + 1] = G;
		data[i + 2] = B;
		data[i + 3] = A;
	}
	return data;
};

// Pure data version: operates on two Uint8ClampedArrays directly
// Masks radar pixels where map is dark (< 116 on all channels)
// Returns the modified radar data
const mergeDopplerRadarImageData = (mapData, radarData) => {
	for (let i = 0; i < radarData.length; i += 4) {
		if ((mapData[i] < 116 && mapData[i + 1] < 116 && mapData[i + 2] < 116)) {
			radarData[i] = 0;
			radarData[i + 1] = 0;
			radarData[i + 2] = 0;
			radarData[i + 3] = 0;
		}
	}
	return radarData;
};

// Canvas-context wrappers for backward compatibility (main-thread fallback)
const removeDopplerRadarImageNoise = (RadarContext) => {
	const RadarImageData = RadarContext.getImageData(0, 0, RadarContext.canvas.width, RadarContext.canvas.height);
	removeDopplerRadarImageNoiseData(RadarImageData.data);
	RadarContext.putImageData(RadarImageData, 0, 0);
};

const mergeDopplerRadarImage = (mapContext, radarContext) => {
	const mapImageData = mapContext.getImageData(0, 0, mapContext.canvas.width, mapContext.canvas.height);
	const radarImageData = radarContext.getImageData(0, 0, radarContext.canvas.width, radarContext.canvas.height);
	mergeDopplerRadarImageData(mapImageData.data, radarImageData.data);
	radarContext.putImageData(radarImageData, 0, 0);
	mapContext.drawImage(radarContext.canvas, 0, 0);
};

// Feature detection
const supportsOffscreenCanvas = () => typeof OffscreenCanvas !== 'undefined';

export {
	getXYFromLatitudeLongitudeDoppler,
	getXYFromLatitudeLongitudeMap,
	removeDopplerRadarImageNoise,
	mergeDopplerRadarImage,
	removeDopplerRadarImageNoiseData,
	mergeDopplerRadarImageData,
	supportsOffscreenCanvas,
};
