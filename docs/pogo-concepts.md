# Pokémon GO concepts (context for building this site)

Game mechanics the site's maths and UI rely on. Numbers marked **(verify)** are from memory and should be checked against the game master or official posts before building logic on them. Everything else is either derived from the game master (`public/data/*.json`) or long-established community knowledge.

---

## 1. Stats, IVs, levels, CP

- Each species has **base stats** Attack / Defense / Stamina (HP) (`pokemon.json` → `atk/def/hp`).
- Each individual Pokémon has **IVs** 0–15 per stat ("appraisal"). A 15/15/15 is a "hundo" (100%). A 0/0/0 is a "nundo".
- **Level** 1–50 in 0.5 steps. Levels above 40 need XL Candy. A **Best Buddy** gets +1 level while it's your active buddy, so it's effectively level 51.
- **CP multiplier (CPM)** per level, from `cpm.json`.
  - Effective stat = `(base + IV) × CPM`. HP = `floor((baseSta + staIV) × CPM)`.
  - **CP** = `floor((Atk+IVa) × √(Def+IVd) × √(Sta+IVs) × CPM² / 10)`, minimum 10.
- **Encounter levels:**
  - Raids, Max Battles and eggs: level 20.
  - Weather-boosted raid catches: level 25.
  - Research rewards: level 15.
  - Wild catches: up to 30, or 35 when weather boosted.
- The "100% CP" shown for a raid boss is the level 20 hundo CP. Players use it to spot a perfect catch before catching it.

## 2. Variants that change stats or costs

| Variant | Effect |
| --- | --- |
| **Shadow** | ×1.2 Attack and ×5/6 Defense in battle. Can't be traded. Can be purified. Can learn Frustration; an event may let you replace it. |
| **Purified** | Each IV +2 (max 15). Set to level 25. Cheaper power-ups. Learns Return. |
| **Lucky** | Only from trades. Half the Stardust cost to power up. IV floor of 12/12/12. Can't be traded again, because a traded Pokémon can never be traded a second time. |
| **Mega / Primal** | Temporary evolution with different stats, and sometimes different types (e.g. Mega Charizard X is Fire/Dragon). Only one Mega can be active per trainer at a time. A Mega also boosts same-type attacks for everyone in the raid **(verify exact multipliers)**. |
| **Dynamax / Gigantamax** | Needed for Max Battles (see §6). Gigantamax forms have signature G-Max moves. |
| **Shiny** | Cosmetic only. The site tracks it for the Pokédex and trading. |
| **Regional forms** | Alolan, Galarian, Hisuian, Paldean. Different species entries (`_alolan`, and so on) with their own types and stats. |
| **Regionals** | Species only found in certain real-world regions (e.g. Heracross, the Tauros breeds). High trade value. |

## 3. Types and damage

- There are 18 types. Effectiveness multipliers come from `types.json`:
  - Super effective: ×1.6. Double weakness: ×2.56.
  - Resisted: ×0.625.
  - Double resist or "immune": ×0.390625. There are no true immunities in GO.
- **STAB** (move type matches the Pokémon's type): ×1.2.
- **Weather boost**: ×1.2 to boosted move types, and raises catch levels:
  - Sunny: Fire, Grass, Ground
  - Rainy: Water, Electric, Bug
  - Partly cloudy: Normal, Rock
  - Cloudy: Fairy, Fighting, Poison
  - Windy: Dragon, Flying, Psychic
  - Snow: Ice, Steel
  - Fog: Dark, Ghost
- Damage formula (PvE and PvP): `floor(0.5 × Power × Atk/Def × multipliers) + 1`.
- **Friendship attack bonus** in raids: Good +3%, Great +5%, Ultra +7%, Best +10% **(verify)**.

## 4. Moves: PvE and PvP stats differ

- Each move has separate **PvE** stats (power, duration in ms, energy) and **PvP** stats (power, energy, turns). Both are in `moves.json`. `pve: null` means the move variant only exists in PvP (e.g. `*_PLUS`).
- Every Pokémon has one **fast move** and one or two **charged moves**. The second charged move is unlocked with Stardust and Candy.
- **Elite / legacy moves** (★ in the UI) can no longer be learned normally. They need an **Elite TM** or a Community Day or event.
- **Hidden Power** has a random type per individual. PvPoke splits it into one entry per type.

## 5. Raids (PvE)

- **Tiers:** 1★, 3★, 5★ (legendary), Mega, Mega Legendary, Elite, and Shadow raids (1/3/5★).
  - Boss HP and CPM by tier are in `calc.raidTier()`: T1 600 HP, T3 3,600, T5 15,000, Mega 9,000, Mega Legendary / Elite 22,500 **(verify for new tiers)**.
  - Raid bosses have 15/15/15 IVs.
- Up to 20 players, each with a party of 6.
- **Counter quality** is usually shown as:
  - **DPS**: damage per second.
  - **TDO**: total damage output before fainting.
  - A combined score such as `(DPS³ × TDO)^¼`, which the site uses. Pokebattler and GamePress use similar ideas.
- A boss's **moveset** decides which of your counters survive, so the site ranks counters separately for each boss charged move.
- **Shadow raids** need Purified Gems to calm the enraged boss. Catches are shadow.
- **Raid Hour**: Wednesdays 6–7 pm local, featuring the current 5★ boss. **Raid Day**: an event with boosted raids.

## 6. Max Battles (Dynamax / Gigantamax)

- Fought at **Power Spots** with Dynamax Pokémon. Each trainer brings **3** Pokémon. Lobbies hold up to 4 trainers. Gigantamax battles allow more players, in groups **(verify current cap)**.
- Your Pokémon use their **fast move** to fill a shared **Max Meter**. When it's full, they Dynamax for a few turns and pick a Max Move:
  - **Max Attack (Max Strike)**: damage. Its type is the fast move's type. Power grows with level (roughly 250 → 300 → 350) **(verify)**.
  - **Max Guard**: a shield for yourself.
  - **Max Spirit**: heals the team.
  - **G-Max moves** replace Max Attack for Gigantamax Pokémon. They use the species' signature type and have higher power **(verify)**.
- Upgrading Max Moves costs **Max Particles** plus Candy.
- Boss tiers run from 1★ to 6★. Gigantamax bosses are the 6★ group battles.
- Caught Max Battle bosses are Dynamax-capable. The site assumes level 20 catches **(verify)**.
- Good attackers have high Attack plus a fast move whose type hits the boss hard. Good tanks have high bulk and resist the boss's attack types. The site uses these heuristics; it doesn't run a full simulation.
- **Max Mondays** (weekly, featured Dynamax boss) and **Max Battle Days** show up in the event feed. That is where the site's Max boss list comes from.

## 7. PvP / GO Battle League

- **Leagues** by CP cap:
  - Little Cup: 500
  - Great League (GL): 1500
  - Ultra League (UL): 2500
  - Master League (ML): no cap
- **Cups** add restrictions such as types or no legendaries (e.g. Retro Cup, Fantasy Cup, Color Cup). "Mega Edition" means Megas are allowed.
- **GBL** rotates leagues and cups weekly within a season. The schedule comes from LeekDuck `go-battle-league` events.
- **Battle rules:**
  - Turn-based, with 0.5 s turns. Fast moves take 1–5 turns and build energy (max 100).
  - Charged moves spend energy.
  - Each player has 2 shields per battle.
  - Charged move ties are decided by the higher Attack stat (CMP).
- **IV logic is inverted** for GL and UL. You want the highest **stat product** (Atk × Def × HP) that still fits under the cap, which usually means low Attack and high Defense/HP. **IV rank** 1–4096 orders all spreads by stat product at their best level under the cap. For ML you want high level and high IVs.
- **Roles** (from PvPoke):
  - **Lead**: first on the field, playing 1 shield vs 1 shield.
  - **Safe swap**: flexible second slot you can switch to.
  - **Closer**: last Pokémon, playing without shields.
- **Team building**: avoid shared weaknesses, cover each other's losses, and never bring duplicate species.
- **PvPoke** rankings are the site's meta source. `score` is 0–100. `scores[]` = [lead, closer, switch, charger, attacker, consistency].

## 8. Trading

- Trainers must be friends and nearby. A Pokémon can only be traded **once**. Shadows, most Mythicals, and Pokémon you are using (buddy, in a gym, and so on) can't be traded.
- **Special trades** (legendary, shiny, or a Pokémon not yet in your Pokédex) are limited to **1 per day**.
- New IVs are rolled on trade, with a floor set by friendship: Good 1, Great 2, Ultra 3, Best 5 **(verify)**. Luckies have a floor of 12.
- **Stardust cost** (Good / Great / Ultra / Best friends) **(verify)**:
  | Trade | Good | Great | Ultra | Best |
  | --- | --- | --- | --- | --- |
  | Normal, already registered | 100 | 100 | 100 | 100 |
  | Normal, new Pokédex entry | 20,000 | 16,000 | 1,600 | 800 |
  | Special, already registered | 20,000 | 16,000 | 1,600 | 800 |
  | Special, new Pokédex entry | 1,000,000 | 800,000 | 80,000 | 40,000 |
- **Lucky chance** goes up with Pokémon age and friendship level. **Lucky Friends** guarantee a lucky trade.
- Trading gives the receiver a Pokédex entry. Trading for **regionals** and **missing shinies** is the main use of the Trade page.
- Trade shorthand: **LF** = looking for, **FT** = for trade.

## 9. Events vocabulary (LeekDuck `eventType`)

- `community-day`: monthly, 3 hours, featured spawn, usually an exclusive move when evolved during the window.
- `pokemon-spotlight-hour`: Tuesdays 6–7 pm.
- `raid-hour`, `raid-day`, `raid-battles` (rotation windows), `elite-raids`.
- `max-mondays`, `max-battles`.
- `go-battle-league` (weekly rotation), `season` (about 3 months), `go-pass` (monthly pass).
- `research`, `research-day`, `go-rocket-takeover`, `pokemon-go-tour`, `pokemon-go-fest`, `wild-area`, `safari-zone`, `city-safari`, `ticketed-event`.
- LeekDuck times **without a trailing `Z` are local wall-clock times**: the event starts at, say, 2 pm in every timezone. Times ending in `Z` are global UTC instants.

## 10. In-game search strings (useful when scanning with Poke Genie)

These filter the Pokémon storage screen:
- `4*` = hundos. `3*` = 82–98%. `0*` = 0–49%.
- `shadow`, `purified`, `lucky`, `shiny`, `legendary`, `mythical`, `costume`, `traded`, `favorite`, `dynamax`, `gigantamax`.
- `@1fighting` = fast move is Fighting type. `@2`/`@3` = charged move slots. `@special` = legacy moves.
- `cp2000-`, `cp-1500`, `age0-7` (caught in the last 7 days), `distance100-`, `buddy1-`.
- `+pikachu` = the whole family.
- Combine with `&` (AND), `,` or `;` (OR), and `!` (NOT). Example: `4*,3*&!shadow&cp-1500`.
- Some keywords are localized in non-English clients.

## 11. Glossary

- **PvE**: raids and Max Battles. **PvP**: trainer battles and GBL.
- **CMP**: charge move priority (ties go to the higher Attack stat).
- **SP**: stat product.
- **XL**: XL Candy, needed above level 40.
- **ETM**: Elite TM.
- **Hundo / nundo**: 15/15/15 and 0/0/0.
- **Rank 1**: the best PvP IV spread for a league.
- **Safe swap**: flexible second slot in a PvP team.
- **Meta**: the strongest commonly used Pokémon in a format.
- **Datamine**: information extracted from game files. Real, but not necessarily released.

## 12. Korean / Japanese terminology (official Pokémon GO text)

Pulled from the game's own ko/ja strings (`data/i18n/*.csv` has every Pokémon, move and type name). Korean GO terms sometimes differ from the main-series games, so always use these.

| English | 한국어 (GO) | 日本語 (GO) |
| --- | --- | --- |
| Great / Ultra / Master League | 슈퍼리그 / 하이퍼리그 / 마스터리그 | スーパーリーグ / ハイパーリーグ / マスターリーグ |
| GO Battle League | GO배틀리그 | GOバトルリーグ |
| Fast Attack / Charged Attack | 노말어택 / 스페셜 어택 | ノーマルアタック / スペシャルアタック |
| Elite Fast / Charged TM | 대단한 기술머신노말 / 대단한 기술머신스페셜 | すごいわざマシン ノーマル / スペシャル |
| Shadow / Purified | 그림자 / 정화 | シャドウ / ライト |
| Lucky | 반짝반짝 | キラ |
| Shiny | 색이 다른 (커뮤니티: 이로치) | 色違い |
| Best Buddy / Best Friend | 베스트 파트너 / 베스트 프렌드 | 最高の相棒 / 大親友 |
| Stardust / Candy / XL Candy | 별의모래 / 사탕 / XL사탕 | ほしのすな / アメ / アメXL |
| Raid Battle / Raid Hour | 레이드배틀 / 레이드 아워 | レイドバトル / レイドアワー |
| Max Battle / Dynamax / Gigantamax | 맥스배틀 / 다이맥스 / 거다이맥스 | マックスバトル / ダイマックス / キョダイマックス |
| Power Spot / Max Particles | 파워스폿 / 맥스 파티클 | パワースポット / マックスパワー |
| Community Day | 커뮤니티 데이 | コミュニティ・デイ |
| Legendary / Mythical | 전설 / 환상 | 伝説 / 幻 |
| Regional form label | 알로라의 모습 · 가라르의 모습 · 히스이의 모습 · 팔데아의 모습 | アローラのすがた · ガラルのすがた · ヒスイのすがた · パルデアのすがた |
| PvP roles (community) | 선봉 / 쿠션 / 마무리 | 先発 / 裏 (控え) / 〆 |

Japanese entries not in the extracted CSVs (e.g. キラ, 最高の相棒, マックスパワー) are **(verify)**.

**Type chart reminder:** Pokémon GO uses ×1.6 / ×0.625 / ×0.390625. Main-series immunities (×0) become ×0.390625 in GO, and STAB is ×1.2 (main series ×1.5). See the `/types` page.
