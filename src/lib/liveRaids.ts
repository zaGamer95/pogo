import { calcCP, cpmAt, WEATHER_TYPES } from './calc';
import type { GameData, LeekRaid } from './data';
import { withDates } from './events';
import { resolveName } from './names';

// ScrapedDuck's raids.min.json mirrors LeekDuck's boss page, which is often updated hours after a
// rotation (e.g. Yveltal still listed after Dialga took over). Its events feed already has the
// schedule ("<Boss> in 5-star Raid Battles", start/end), so reconcile the two at load time:
// bosses whose raid-battles event has ended (and no running one covers them) are dropped, and
// bosses of running raid-battles events that the boss list lacks are added.

/** "Dialga in 5-star Raid Battles" → "5-Star Raids"; "… in Mega Raids" → "Mega Raids". */
function eventTier(name: string, legendary: boolean): string | null {
  const star = name.match(/(\d)-star/i);
  if (star) return `${star[1]}-Star Raids`;
  if (/mega raids/i.test(name)) return 'Mega Raids';
  if (/shadow raids/i.test(name) && legendary) return '5-Star Raids';
  return null;
}

export function reconcileRaids(data: GameData, now = new Date()): LeekRaid[] {
  const keyOf = (name: string) => {
    const r = resolveName(data, name);
    return r.species ? `${r.species.id}|${r.shadow}` : null;
  };
  const scheduled = withDates(data.events.filter((e) => e.eventType === 'raid-battles')).map((e) => {
    const bosses = (e.extraData?.raidbattles as { bosses?: { name: string; image: string; canBeShiny: boolean }[] } | undefined)?.bosses ?? [];
    // "Shadow Landorus (Incarnate Forme) in Shadow Raids" lists its boss as plain "Landorus (Incarnate)"
    const shadowEvent = /shadow raids/i.test(e.name);
    return { e, bosses: bosses.map((b) => (shadowEvent && !/^shadow /i.test(b.name) ? { ...b, name: `Shadow ${b.name}` } : b)) };
  });
  const running = scheduled.filter(({ e }) => e.startDate <= now && e.endDate > now);
  const runningKeys = new Set(running.flatMap(({ bosses }) => bosses.map((b) => keyOf(b.name))));
  const ended = new Set(
    scheduled
      .filter(({ e }) => e.endDate <= now)
      .flatMap(({ bosses }) => bosses.map((b) => keyOf(b.name)))
      .filter((k) => k && !runningKeys.has(k)),
  );

  const raids = data.raids.filter((r) => !ended.has(keyOf(r.name)));
  const have = new Set(raids.map((r) => keyOf(r.name)));

  for (const { e, bosses } of running) {
    for (const b of bosses) {
      const key = keyOf(b.name);
      if (!key || have.has(key)) continue;
      const { species } = resolveName(data, b.name);
      if (!species) continue;
      const tier = eventTier(e.name, species.tags.includes('legendary') || species.tags.includes('mythical'));
      if (!tier) continue;
      // Catch CP uses the non-mega form (same base stats for shadows)
      const caught = data.byId.get(species.id.replace(/_mega(_[xy])?$|_primal$/, '')) ?? species;
      const cp = (iv: number, level: number) => calcCP(caught, [iv, iv, iv], cpmAt(data, level));
      raids.push({
        name: b.name,
        tier,
        canBeShiny: b.canBeShiny,
        types: species.types.filter((t) => t !== 'none').map((name) => ({ name })),
        combatPower: { normal: { min: cp(10, 20), max: cp(15, 20) }, boosted: { min: cp(10, 25), max: cp(15, 25) } },
        boostedWeather: Object.entries(WEATHER_TYPES)
          .filter(([, types]) => species.types.some((t) => types.includes(t)))
          .map(([name]) => ({ name })),
        image: b.image,
      });
      have.add(key);
    }
  }
  // Keep LeekDuck's tier-group order (1★, 3★, 5★, Mega, then the shadow groups)
  const group = (r: LeekRaid) => `${/^shadow /i.test(r.name)}|${r.tier}`;
  const order = [...new Set(data.raids.map(group))];
  const rank = (r: LeekRaid) => (order.includes(group(r)) ? order.indexOf(group(r)) : order.length);
  return raids.sort((a, b) => rank(a) - rank(b));
}
