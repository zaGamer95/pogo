import { useEffect, useState } from 'react';
import { loadRankings, type Rankings } from '../lib/data';

export function useRankings(key: string | undefined) {
  const [state, setState] = useState<{ key?: string; rankings: Rankings | null; error: string | null }>({ rankings: null, error: null });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    loadRankings(key).then(
      (rankings) => alive && setState({ key, rankings, error: null }),
      (e) => alive && setState({ key, rankings: null, error: String(e) }),
    );
    return () => {
      alive = false;
    };
  }, [key]);
  // Only expose results for the key that was asked for (avoids a flash of the previous league)
  return state.key === key ? state : { rankings: null, error: null };
}
