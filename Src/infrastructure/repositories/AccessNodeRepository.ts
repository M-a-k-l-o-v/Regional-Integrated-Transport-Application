import { prisma } from "../orm/prisma/client";
import type { NormalisedAccessNode } from "../../ingestion/normalisers/accessNodesNormaliser";

export class AccessNodeRepository {
  async upsertMany(nodes: NormalisedAccessNode[]): Promise<number> {
    let count = 0;

    for (const n of nodes) {
      await prisma.busStop.upsert({
        where: { stopId: n.stationId },
        update: {
          name: n.name,
          latitude: n.latitude,
          longitude: n.longitude,
          localityId: n.localityId ?? null,
          stopType: n.stopType ?? null,
        },
        create: {
          stopId: n.stationId,
          name: n.name,
          latitude: n.latitude,
          longitude: n.longitude,
          localityId: n.localityId ?? null,
          stopType: n.stopType ?? null,
        },
      });

      count++;
    }

    return count;
  }
}