# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeatherStar 4000+ is a fan-made web simulator of The Weather Channel's WeatherStar 4000 unit from the mid-to-late 90s. It is a hybrid ASP.NET Core 8 / vanilla JavaScript application. The backend serves static files and acts as a CORS proxy to weather APIs; the frontend renders retro-styled weather displays on HTML5 canvas elements.

This is a fork of https://github.com/vbguyny/ws4kp (upstream live site: https://battaglia.ddns.net/twc).

## Build and Run

```bash
# Restore dependencies and build
dotnet build

# Run in development mode (http://localhost:5035)
dotnet run

# Run with HTTPS (https://localhost:7295)
dotnet run --launch-profile https
```

The app requires .NET 8 SDK. There are no npm dependencies — all JavaScript is vanilla with vendored libraries.

There is no test suite, linter, or formatter configured in this project.

## Architecture

### Backend (ASP.NET Core 8)

- **Program.cs** — Minimal API setup. Configures static file serving with `index.html` as default, memory cache, and Swagger (dev only). No API controllers; the Controllers directory is explicitly excluded in the csproj.
- **Middleware/CorsMiddleware.cs** — The sole backend logic. Intercepts requests to `/cors/?u=<url>`, validates the requesting host and target URL against whitelists, fetches the remote resource, and caches responses in memory. Cache TTLs vary by source (5 min for frequently-updating sources like radar, 3 hours for tides/air quality, 1 hour default). Retries server errors up to 3 times.

### Frontend

The app uses two HTML pages:
- **index.html** — Main UI with location search form, navigation controls, and settings. Loads `Scripts/index.js`.
- **twc3.html** — Loaded in an iframe by index.html. Contains 15+ `<canvas>` elements for rendering weather data in the retro WeatherStar 4000 style. Loads the bulk of the application JavaScript.

### Key JavaScript Files (Scripts/)

- **twc3.js** (~15k LOC) — Core engine. Handles all weather API calls (via `/cors/` proxy), data processing, canvas rendering of weather segments (current conditions, forecasts, radar, almanac, hazards), and segment navigation.
- **index.js** (~1.9k LOC) — Form handling, location input, navigation menus, global state, UI event handlers.
- **Icons.js** — Weather condition icon mapping and canvas rendering.
- **metars.js** — METAR aviation weather observation parsing.
- **stations.js** (~35k LOC) — Complete US weather station database (lat/lon, identifiers). Large static data file.
- **RegionalCities.js / TravelCities.js / States.js** — Static geographic data for regional/travel forecasts.
- **Timer.js / TimerWorker.js** — Web Worker-based timer for auto-refresh.
- **speech1.js** — Text-to-speech narration.
- **twc1.js / twc2.js** — Legacy rendering implementations.

Third-party vendored libraries: jQuery 3.1.0, jquery.autocomplete, jquery.touchSwipe, NoSleep.js, libgif.js.

### Static Assets

- **Fonts/** — Custom WeatherStar 4000 bitmap-style fonts (Star4000 family, Star 4 Radar) in WOFF/TTF.
- **Images/** — Weather icons, radar base maps (CONUS/Alaska/Hawaii), backgrounds, moon phases, UI elements.
- **Audio/** — Background music tracks.
- **Styles/** — `index.css` (main UI), `twc3.css` (retro weather display), `twc2.css` (alternative theme).

### Data Flow

1. User enters a location in index.html
2. index.js geocodes the location and passes data to twc3.html via the iframe
3. twc3.js fetches weather data from multiple APIs through the `/cors/` proxy endpoint
4. Data is rendered to canvas elements styled to match the original WeatherStar 4000 display
5. Segments auto-rotate on a timer with 10-minute data refresh

### CORS Proxy Allowed External APIs

weather.gov, api.weather.gov, api.weather.com, aviationweather.gov, wunderground.com, tidesandcurrents.noaa.gov, airnow.gov, radar.weather.gov, mesonet.agron.iastate.edu, and several others. Any URL ending in `?rss=1` is also allowed (RSS feed support).

## Code Style Notes

- JavaScript is pre-ES6 module style — scripts are loaded via `<script>` tags and use global scope.
- jQuery is used extensively throughout the frontend.
- Canvas rendering is the primary display mechanism (not DOM-based UI).
- Static asset versions are tracked via query parameters (e.g., `?v=79`) in HTML script/link tags.
