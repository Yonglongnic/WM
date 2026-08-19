/**
 * RPC: getFredSeries -- reads seeded FRED time series data from Railway seed cache.
 * All external FRED API calls happen in seed-economy.mjs on Railway.
 */

import type {
  ServerContext,
  GetFredSeriesRequest,
  GetFredSeriesResponse,
} from '../../../../src/generated/server/worldmonitor/economic/v1/service_server';

import { getCachedJson } from '../../../_shared/redis';
import {
  applyFredObservationLimit,
  fetchPublicFredSeries,
  fredSeedKey,
  localPublicAccessEnabled,
  normalizeFredLimit,
} from './_fred-shared';

export async function getFredSeries(
  _ctx: ServerContext,
  req: GetFredSeriesRequest,
): Promise<GetFredSeriesResponse> {
  if (!req.seriesId) return { series: undefined };
  try {
    const seedKey = fredSeedKey(req.seriesId);
    const result = await getCachedJson(seedKey, true) as GetFredSeriesResponse | null;
    const limit = normalizeFredLimit(req.limit);
    if (result?.series) return { series: applyFredObservationLimit(result.series, limit) };
    if (localPublicAccessEnabled()) {
      const series = await fetchPublicFredSeries(req.seriesId.trim().toUpperCase(), limit);
      if (series) return { series };
    }
    return { series: undefined };
  } catch {
    return { series: undefined };
  }
}
