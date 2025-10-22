# YouTube Lite v2 (Static) — Search-first UI

Revamped static YouTube-like client using the **official YouTube Data API v3** and **YouTube IFrame Player**.

## What's new vs v1
- **Search-first**: type a name, press Enter → shows **many results** (paging with **Load more**).
- **Filters**: order by **Relevance / Upload date / View count**; **SafeSearch** toggle.
- **Duration overlay** on thumbnails, **view count**, **time-ago**, **channel icon**.
- **Watch page** with related videos.
- Cleaned JS (no optional-chaining typos), better error boxes.

## Setup
1) Create your API key (YouTube Data API v3) in Google Cloud Console (enable API, then Credentials → API key).
2) Restrict the key to HTTP referrers (your GitHub Pages domain). For local test, add:
   - `http://127.0.0.1:5500/*`
   - `http://localhost:5500/*`
3) Copy `config.example.js` → `config.js` and paste your key.

## Run locally
Use a static server (VS Code Live Server; or `py -m http.server 5500` in the folder).
Open http://127.0.0.1:5500/

## Routes
- `#search?q=QUERY` — search results with filters and "Load more"
- `#watch?v=VIDEO_ID` — watch page
- `#home` (default) — Most Popular in your REGION

