# CLAUDE.md

Personal Pokémon GO companion site (non-commercial). Before working on it, read:

- [`pokego_claude.md`](pokego_claude.md) — page structure, source layout, data files & schemas, localStorage keys, algorithms, **data sourcing & evidence policy**.
- [`docs/pogo-concepts.md`](docs/pogo-concepts.md) — Pokémon GO mechanics the maths and UI rely on (CP/IVs, variants, raids, Max Battles, PvP, trading, search strings).

Rules:
- **Names are always trilingual (한국어 / English / 日本語).** Render Pokémon with `<PokeName>`, moves with `<MoveName>`; never print `species.name`. UI text goes through `t()` with Korean in `src/i18n/ko/*.ts`. Name data comes from `data/i18n/*.csv` (fix names via `overrides.csv`).
- Type effectiveness is **Pokémon GO's** (×1.6 / ×0.625 / ×0.390625), never the main-series 2× / ½× / 0×.
- Keep `pokego_claude.md` in sync in the same change when pages, data files, schemas or storage keys change.
- Never add community claims to the site that don't meet the evidence rules in `pokego_claude.md` §7 (no speculation, guesses or unsourced "leaks").
- Items marked **(verify)** in the concepts doc must be checked against the game master or an official source before being used in code.

Commands: `npm run dev` · `npm run data` (refresh `public/data`, gitignored) · `npm run build` · `npm run typecheck`.
