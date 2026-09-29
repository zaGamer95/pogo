# PoGo Companion

A personal Pokémon GO helper that pulls the bits I actually use from LeekDuck, PvPoke and Poke Genie into one place. Non-commercial, personal use.

## Pages

| Page | What it does |
| --- | --- |
| **Today** | What's live now, the next 7 days, headline raids, and the current GBL week. |
| **Calendar** | Month grids for this month and next, built from LeekDuck events. Filter by event type and click an event for details. |
| **Raids & Max** | Current raid bosses with 100% IV CP (Lv 20 / boosted Lv 25), weaknesses, and top counters. Each boss charged move gets its own counter list, and "Your best 6" comes from your own Pokémon. The Max Battles tab covers upcoming Dynamax/Gigantamax bosses (from events, or bosses you add) with Max attackers and tanks. |
| **My Pokémon** | Your roster: IVs, level/CP, moves, shadow/purified/lucky/Dynamax, and raid-ready and PvP-ready flags. Shows Great League and Ultra League IV ranks. Import a Poke Genie CSV export or a JSON backup. |
| **Leagues** | The live GBL week and upcoming rotations, each linked to its meta. |
| **Meta** | PvPoke rankings for any league (overall, leads, switches, closers, …) and suggested lead / swap / closer cores. |
| **Trade** | Pokédex, shiny and lucky tracker (tap grid, paste dex ranges, or fill from My Pokémon), missing dex entries, missing released shinies, spare Pokémon to give, and a copyable LF/FT post (English or Korean). |
| **My Teams** | Your best PvP team for a league (meta score × IV rank, shared-weakness penalty) and your best 6-Pokémon raid party against a chosen boss. |

See [`pokego_claude.md`](pokego_claude.md) for the site structure and data schemas, and [`docs/pogo-concepts.md`](docs/pogo-concepts.md) for game mechanics.

Your roster is saved in the browser's localStorage. Use **Export backup** on the My Pokémon page to keep a copy or move it to another device.

## Running locally

```bash
npm install
npm run dev        # downloads data on first run, then starts Vite
npm run data       # refresh the data any time
npm run build      # production build in dist/
```

## Data sources

`scripts/fetch-data.mjs` downloads the sources and writes compact JSON to `public/data/`:

- **ScrapedDuck** (LeekDuck scrape): events and current raid bosses
- **PvPoke**: species list, PvP moves, league formats and rankings
- **PokeMiners game master**: PvE move stats, CP multipliers, type chart, Dynamax/Gigantamax flags

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` rebuilds the data and deploys the site on every push to `main` and every 6 hours. To turn it on, go to **Settings → Pages → Source: GitHub Actions** in the GitHub repo.

## Caveats

- Raid counter scores use a simplified DPS/TDO estimate (GamePress-style). They're good for ranking counters, not for exact time-to-win.
- Max Battle rankings are heuristic: Attack × type effectiveness of the Max Move for attackers, and bulk × resistances for tanks. The game data only flags some Dynamax-capable species, so there's an "include all species" toggle.
- LeekDuck has no feed of current Max Battle bosses. The list comes from Max Monday and Max Battle Day events, plus any you add yourself.
