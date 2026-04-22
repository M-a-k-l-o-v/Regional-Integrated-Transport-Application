import { ReliabilityRepository } from "../infrastructure/repositories/ReliabilityRepository";

export type ReliabilityBucket = {
  date: string;
  count: number;
  avgDelay: number;
};

export type ReliabilityReport = {
  stanox: string;
  days: number;
  total: number;
  onTime: number;
  late: number;
  early: number;
  avgDelayMinutes: number | null;
  buckets: ReliabilityBucket[];
};

/**
 * Computes reliability scores from the captured TRUST delay log. Keeping the
 * aggregation out of the HTTP handler lets cron jobs, reports, and tests
 * reuse the same logic (Single Responsibility).
 */
export class ReliabilityService {
  constructor(private readonly repository: ReliabilityRepository) {}

  async computeStationReliability(stanox: string, days: number): Promise<ReliabilityReport> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const samples = await this.repository.findDepartureDelays(stanox, since);

    const total = samples.length;
    if (total === 0) {
      return {
        stanox,
        days,
        total: 0,
        onTime: 0,
        late: 0,
        early: 0,
        avgDelayMinutes: null,
        buckets: [],
      };
    }

    const counts = { onTime: 0, late: 0, early: 0 };
    let delaySum = 0;
    const bucketMap = new Map<string, { sum: number; count: number }>();

    for (const sample of samples) {
      const v = sample.timetableVariationMinutes;
      delaySum += v;
      if (v <= 0) counts.early += 1;
      else if (v <= 1) counts.onTime += 1;
      else counts.late += 1;

      const date = sample.receivedAt.toISOString().slice(0, 10);
      const bucket = bucketMap.get(date) ?? { sum: 0, count: 0 };
      bucket.sum += v;
      bucket.count += 1;
      bucketMap.set(date, bucket);
    }

    const buckets: ReliabilityBucket[] = Array.from(bucketMap.entries()).map(([date, b]) => ({
      date,
      count: b.count,
      avgDelay: Math.round((b.sum / b.count) * 10) / 10,
    }));

    return {
      stanox,
      days,
      total,
      onTime: counts.onTime,
      late: counts.late,
      early: counts.early,
      avgDelayMinutes: Math.round((delaySum / total) * 10) / 10,
      buckets,
    };
  }
}
