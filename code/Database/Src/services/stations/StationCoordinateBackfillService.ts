import { PrismaClient } from "@prisma/client";
import { haversineDistanceMetres } from "../journeys/helpers";
import {
  extractStationTokens,
  isFrontageStopName,
  matchesStationFrontageStop,
  scoreStationFrontageStop,
} from "./stationFrontageMatching";

type CandidateStop = {
  stopId: string;
  name: string;
  localityName: string | null;
  latitude: number;
  longitude: number;
  score: number;
};

type BackfillOptions = {
  stationIds?: string[];
  dryRun?: boolean;
};

export type StationCoordinateBackfillSummary = {
  scanned: number;
  updated: number;
  unchanged: number;
  skipped: number;
  examples: Array<{
    stationId: string;
    name: string;
    latitude: number;
    longitude: number;
    candidateCount: number;
    anchorStopId: string;
  }>;
};

const MAX_CANDIDATES_PER_STATION = 24;
const CLUSTER_RADIUS_METRES = 750;
const MIN_SCORE = 6;

export class StationCoordinateBackfillService {
  constructor(private readonly prisma: PrismaClient) {}

  async backfill(options: BackfillOptions = {}): Promise<StationCoordinateBackfillSummary> {
    const stations = await this.prisma.station.findMany({
      where: {
        AND: [
          options.stationIds?.length ? { stationId: { in: options.stationIds } } : {},
          {
            OR: [
              { latitude: null },
              { longitude: null },
            ],
          },
        ],
      },
      select: {
        stationId: true,
        name: true,
      },
      orderBy: { stationId: "asc" },
    });

    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const examples: StationCoordinateBackfillSummary["examples"] = [];

    for (const station of stations) {
      const bestCluster = await this.findBestCluster(station.name);
      if (!bestCluster) {
        skipped += 1;
        continue;
      }

      if (!options.dryRun) {
        await this.prisma.station.update({
          where: { stationId: station.stationId },
          data: {
            latitude: bestCluster.latitude,
            longitude: bestCluster.longitude,
          },
        });
      }

      updated += 1;
      if (examples.length < 20) {
        examples.push({
          stationId: station.stationId,
          name: station.name,
          latitude: bestCluster.latitude,
          longitude: bestCluster.longitude,
          candidateCount: bestCluster.candidateCount,
          anchorStopId: bestCluster.anchorStopId,
        });
      }
    }

    unchanged = 0;

    return {
      scanned: stations.length,
      updated,
      unchanged,
      skipped,
      examples,
    };
  }

  private async findBestCluster(stationName: string): Promise<{
    latitude: number;
    longitude: number;
    candidateCount: number;
    anchorStopId: string;
  } | null> {
    const tokens = extractStationTokens(stationName);
    if (tokens.length === 0) return null;

    const candidates = await this.prisma.busStop.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: "station", mode: "insensitive" } },
              { name: { contains: "rail", mode: "insensitive" } },
            ],
          },
          {
            OR: tokens.flatMap((token) => [
              { name: { contains: token, mode: "insensitive" } },
              { locality: { name: { contains: token, mode: "insensitive" } } },
            ]),
          },
          { latitude: { not: null } },
          { longitude: { not: null } },
        ],
      },
      select: {
        stopId: true,
        name: true,
        latitude: true,
        longitude: true,
        locality: {
          select: { name: true },
        },
      },
      take: MAX_CANDIDATES_PER_STATION,
    });

    const scored: CandidateStop[] = candidates
      .filter((stop): stop is typeof stop & { latitude: number; longitude: number } => stop.latitude !== null && stop.longitude !== null)
      .filter((stop) => isFrontageStopName(stop.name) && matchesStationFrontageStop(tokens, stop.name, stop.locality?.name ?? null))
      .map((stop) => ({
        stopId: stop.stopId,
        name: stop.name,
        localityName: stop.locality?.name ?? null,
        latitude: stop.latitude,
        longitude: stop.longitude,
        score: scoreStationFrontageStop(stationName, stop.name, stop.locality?.name ?? null),
      }))
      .filter((stop) => stop.score >= MIN_SCORE)
      .sort((left, right) => right.score - left.score);

    const anchor = scored[0];
    if (!anchor) return null;

    const cluster = scored.filter(
      (candidate) =>
        haversineDistanceMetres(anchor.latitude, anchor.longitude, candidate.latitude, candidate.longitude) <= CLUSTER_RADIUS_METRES
    );

    if (cluster.length === 0) return null;

    const latitude = cluster.reduce((sum, candidate) => sum + candidate.latitude, 0) / cluster.length;
    const longitude = cluster.reduce((sum, candidate) => sum + candidate.longitude, 0) / cluster.length;

    return {
      latitude,
      longitude,
      candidateCount: cluster.length,
      anchorStopId: anchor.stopId,
    };
  }
}
