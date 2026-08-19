import type {
  ServerContext,
  GetEconomicStressRequest,
  GetEconomicStressResponse,
  EconomicStressComponent,
} from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';
import { getCachedJson } from '../../../_shared/redis';
import { fetchPublicFredSeries, localPublicAccessEnabled } from './_fred-shared';

const SEED_CACHE_KEY = 'economic:stress-index:v1';

function buildFallbackResult(): GetEconomicStressResponse {
  return {
    compositeScore: 0,
    label: '',
    components: [],
    seededAt: '',
    unavailable: true,
  };
}

const STRESS_COMPONENTS = [
  { id: 'T10Y2Y', label: 'Yield Curve', weight: 0.20, score: (v: number) => Math.min(100, Math.max(0, (0.5 - v) / 2 * 100)) },
  { id: 'T10Y3M', label: 'Bank Spread', weight: 0.15, score: (v: number) => Math.min(100, Math.max(0, (0.5 - v) / 1.5 * 100)) },
  { id: 'VIXCLS', label: 'Volatility', weight: 0.20, score: (v: number) => Math.min(100, Math.max(0, (v - 15) / 65 * 100)) },
  { id: 'STLFSI4', label: 'Financial Stress', weight: 0.20, score: (v: number) => Math.min(100, Math.max(0, (v + 1) / 6 * 100)) },
  { id: 'GSCPI', label: 'Supply Chain', weight: 0.15, score: (v: number) => Math.min(100, Math.max(0, (v + 2) / 6 * 100)) },
  { id: 'ICSA', label: 'Job Claims', weight: 0.10, score: (v: number) => Math.min(100, Math.max(0, (v - 180000) / 320000 * 100)) },
] as const;

function stressLabel(score: number): string {
  if (score < 20) return 'Low';
  if (score < 40) return 'Moderate';
  if (score < 60) return 'Elevated';
  if (score < 80) return 'Severe';
  return 'Critical';
}

async function buildLocalStressResult(): Promise<GetEconomicStressResponse | null> {
  if (!localPublicAccessEnabled()) return null;
  const byId = new Map<string, { observations: Array<{ date: string; value: number }> }>();
  const readSeededSeries = async (id: string): Promise<{ observations: Array<{ date: string; value: number }> } | null> => {
    try {
      const raw = await getCachedJson(`economic:fred:v1:${id}:0`, true) as {
        series?: { observations?: Array<{ date: string; value: number }> };
        observations?: Array<{ date: string; value: number }>;
      } | null;
      const series = raw?.series ?? raw;
      return Array.isArray(series?.observations) ? series as { observations: Array<{ date: string; value: number }> } : null;
    } catch {
      return null;
    }
  };
  const seeded = await Promise.all(STRESS_COMPONENTS.map(async (component) => [component.id, await readSeededSeries(component.id)] as const));
  for (const [id, series] of seeded) if (series) byId.set(id, series);

  // If a relay cycle has not written a particular series yet, use the same
  // official keyless FRED graph CSV fallback as the indicator endpoint.
  const missingIds = STRESS_COMPONENTS.map((component) => component.id).filter((id) => !byId.has(id));
  const fetched = await Promise.all(missingIds.map(async (id) => [id, await fetchPublicFredSeries(id, 120)] as const));
  for (const [id, series] of fetched) if (series) byId.set(id, series);

  const components: EconomicStressComponent[] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const component of STRESS_COMPONENTS) {
    const observations = byId.get(component.id)?.observations ?? [];
    const latest = [...observations].reverse().find((observation) => Number.isFinite(observation.value));
    if (!latest) {
      if (component.id !== 'GSCPI') return null;
      components.push({ id: component.id, label: component.label, rawValue: 0, score: 0, weight: component.weight, missing: true });
      continue;
    }
    const score = component.score(latest.value);
    weightedSum += score * component.weight;
    totalWeight += component.weight;
    components.push({ id: component.id, label: component.label, rawValue: latest.value, score, weight: component.weight, missing: false });
  }
  if (totalWeight <= 0) return null;
  const compositeScore = Math.round((weightedSum / totalWeight) * 10) / 10;
  return { compositeScore, label: stressLabel(compositeScore), components, seededAt: new Date().toISOString(), unavailable: false };
}

export async function getEconomicStress(
  _ctx: ServerContext,
  _req: GetEconomicStressRequest,
): Promise<GetEconomicStressResponse> {
  try {
    const raw = await getCachedJson(SEED_CACHE_KEY, true) as Record<string, unknown> | null;
    if (!raw || raw.unavailable) {
      return (await buildLocalStressResult()) ?? buildFallbackResult();
    }

    const components = (Array.isArray(raw.components) ? raw.components : []).map(
      (c: Record<string, unknown>): EconomicStressComponent => {
        const isMissing = c.missing === true || c.rawValue === null || c.rawValue === undefined;
        return {
          id: String(c.id ?? ''),
          label: String(c.label ?? ''),
          rawValue: isMissing ? 0 : Number(c.rawValue),
          score: Number(c.score ?? 0),
          weight: Number(c.weight ?? 0),
          missing: isMissing,
        };
      },
    );

    return {
      compositeScore: Number(raw.compositeScore ?? 0),
      label: String(raw.label ?? ''),
      components,
      seededAt: String(raw.seededAt ?? ''),
      unavailable: false,
    };
  } catch {
    return (await buildLocalStressResult()) ?? buildFallbackResult();
  }
}
