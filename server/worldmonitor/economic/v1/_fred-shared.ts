import type { FredSeries } from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';

export const FRED_KEY_PREFIX = 'economic:fred:v1';

export function fredSeedKey(seriesId: string): string {
  return `${FRED_KEY_PREFIX}:${seriesId}:0`;
}

export function normalizeFredLimit(limit: number): number {
  return limit > 0 ? Math.min(limit, 1000) : 120;
}

export function applyFredObservationLimit(series: FredSeries, limit: number): FredSeries {
  if (limit > 0 && series.observations.length > limit) {
    return { ...series, observations: series.observations.slice(-limit) };
  }
  return series;
}

/**
 * The official FRED JSON API requires a registered key. FRED also publishes
 * the same observations through its public graph CSV download. The local
 * Docker build uses that keyless official endpoint only as a cache-miss
 * fallback; hosted deployments remain seed/cache-backed.
 */
export function localPublicAccessEnabled(): boolean {
  return typeof process !== 'undefined' && process.env?.WM_LOCAL_PUBLIC_ACCESS === 'true';
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

export async function fetchPublicFredSeries(seriesId: string, limit = 120): Promise<FredSeries | null> {
  if (!localPublicAccessEnabled()) return null;
  try {
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
    const response = await globalThis.fetch(url, {
      headers: {
        Accept: 'text/csv',
        'User-Agent': 'WorldMonitor-local/1.0 (official public data fallback)',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const body = await response.text();
    const lines = body.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return null;
    const observations = lines.slice(1).map((line) => {
      const [date, rawValue] = parseCsvLine(line);
      const value = Number(rawValue);
      return date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value)
        ? { date, value }
        : null;
    }).filter((item): item is { date: string; value: number } => item !== null).slice(-limit);
    if (!observations.length) return null;
    return {
      seriesId,
      title: seriesId,
      units: '',
      frequency: '',
      observations,
    };
  } catch {
    return null;
  }
}
