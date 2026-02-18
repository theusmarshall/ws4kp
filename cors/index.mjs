// pass through api requests
import { Readable } from 'node:stream';

const cors = async (req, res) => {
	const headers = {
		'user-agent': '(WeatherStar 4000+, ws4000@netbymatt.com)',
		accept: req.headers.accept,
	};

	// get query parameters, filtering out 'u'
	const queryParams = new URLSearchParams(
		Object.entries(req.query).filter(([key]) => key !== 'u'),
	);
	const query = queryParams.size > 0 ? `?${queryParams}` : '';
	const url = `https://api.weather.gov${req.path}${query}`;

	try {
		const response = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(10000),
		});

		res.status(response.status);
		res.header('content-type', response.headers.get('content-type'));
		Readable.fromWeb(response.body).pipe(res);
	} catch (e) {
		console.error(e);
		if (!res.headersSent) {
			res.status(504).json({ error: 'Upstream request failed or timed out' });
		}
	}
};

export default cors;
