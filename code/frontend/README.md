# Frontend — Lancashire Transport

Next.js web application providing journey planning, departure boards, interactive maps, and road information for the Lancashire transport network.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1 (App Router with server components) |
| React | 19.2 |
| Styling | Tailwind CSS 4 |
| Maps | Leaflet (dynamically imported to avoid SSR issues) |
| Language | TypeScript 5 |

---

## Getting Started

> If you are setting up the whole project for the first time, follow the root [README](../../README.md) — it covers both the backend and frontend together.

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.local.example .env.local
# The only variable is:
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000

# 3. Start the dev server
npm run dev       # Runs on http://localhost:3001
```

The frontend expects the backend to be running on port 3000. If it is not running, pages will still load but data panels will show errors or empty states.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the Next.js dev server with hot-reload |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## Pages

| Route | What it shows |
|-------|---------------|
| `/home` | Dashboard — journey planner form, quick-access links, weather |
| `/journeys` | Journey planning results with an interactive map overlay |
| `/journeys/leg` | Leg detail — stop-by-stop sequence, route map, disruptions, weather |
| `/map` | Full-screen interactive network map with live bus tracking |
| `/boards` | Departure board directory (search for a station or stop) |
| `/location-info/train` | Rail station board, live status, and station facilities |
| `/location-info/bus` | Bus stop or station departures |
| `/road-info` | M6 corridor Variable Message Signs map and list |

---

## How It Works

### Server components for fast loading

All data fetching happens in **server components**. When you visit a page, the server calls the backend API, builds the HTML, and sends it to the browser fully rendered. This means the first paint is fast and the page is usable immediately — no loading spinners on initial load.

### Client components for interactivity

Components that need browser APIs or user interaction are marked with `"use client"`. These include:

- **Leaflet maps** — the map library requires the `window` object, so it cannot run on the server.
- **Bottom sheets and scroll pickers** — touch-driven UI that manages its own state.
- **Live vehicle polling** — fetches new bus positions every 15 seconds.
- **Filter and sort controls** — journey result filtering, amenity sorting.

### Leaflet pattern

Every map component follows the same approach to avoid SSR crashes:

1. The component is marked `"use client"`.
2. Inside a `useEffect`, Leaflet is loaded with `await import("leaflet")`.
3. The map is initialised, and a `mapReady` state flag is set to `true`.
4. Data layers are rendered only after `mapReady` is true.
5. The map is cleaned up on unmount.

---

## Accessibility

The frontend targets **WCAG 2.1 AA** compliance:

- **Skip-to-content link** — hidden until focused, lets keyboard users jump past the navigation.
- **ARIA attributes** — `aria-label` on navigation, `aria-current="page"` on active links, `aria-modal` on dialogs.
- **Focus indicators** — a visible 2 px brand-coloured ring on all focusable elements via `:focus-visible`.
- **Reduced motion** — a `prefers-reduced-motion` media query disables all animations and transitions.
- **Touch targets** — all buttons and links have a minimum height of 36 px.

---

## Responsive Design

The layout is mobile-first, designed from 360 px upward:

| Breakpoint | Layout |
|------------|--------|
| **Mobile** (default) | Bottom tab navigation, stacked cards, compact legends below maps |
| **Tablet** (`sm:` / 640 px) | Two-column grids, inline stat tiles |
| **Desktop** (`md:` / 768 px+) | Top navigation bar, side-by-side map and route list, full info panels |

---

## Project Layout

```
app/
  layout.tsx              Root layout — fonts, theme, metadata
  globals.css             Design tokens, accessibility styles, component classes
  lib/transportApi.ts     API client, TypeScript types, formatting helpers

  home/page.tsx           Home dashboard
  journeys/               Journey planner results + leg detail
  map/                    Full-screen interactive network map
  boards/                 Departure board directory
  location-info/          Bus and rail departure pages
  road-info/              VMS road information

  components/
    AppShell.tsx           Page wrapper with top nav (desktop) and bottom nav (mobile)
    PanelCard.tsx          Reusable card container with title, eyebrow, description
    PageHeader.tsx         Page title + back button
    JourneyPlannerForm.tsx Journey origin/destination/time form
    StationFacilitiesPanel.tsx   Station accessibility and amenity display
    ThemeToggle.tsx        Light / dark theme switch
    ...                    Other shared components

public/
  icons/                  SVG icons used in maps and UI
```
