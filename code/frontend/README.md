# Regional Integrated Transport Frontend

Next.js frontend for the Regional Integrated Transport project.

## Current Status

This app is still a prototype shell.

Implemented:
- static prototype routes for home, map, bus detail, and train detail
- shared app shell and project metadata

Not yet implemented:
- backend API integration
- live refresh and freshness labels
- scheduled/live fallback messaging from real API state
- Leaflet/OpenStreetMap map integration
- live bus markers
- weather and road overlays
- station facilities display
- recent searches / stored preferences

Authoritative product scope comes from:
- `design/Design Report - TransitPredict.pdf`
- `design/Transport Application Overview.pdf`

This README describes the current frontend implementation status only.

## Getting Started

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Prototype routes currently available:
- `/`
- `/home`
- `/map`
- `/location-info/train`
- `/location-info/bus`

## Recovery Direction

The next frontend milestone is to replace static mock content with real scheduled-data flows:
1. search
2. bus departures
3. rail departures
4. station/stop detail

Live map, weather, road, and facilities features should only be added after the backend exposes those contracts.
