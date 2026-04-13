import { prisma } from "../orm/prisma/client";
import type { NormalisedAccessNode } from "../../ingestion/normalisers/accessNodesNormaliser";

export class AccessNodeRepository {
  async upsertMany(nodes: NormalisedAccessNode[]): Promise<number> {
    let count = 0;

    for (const n of nodes) {
      /* ===== BUS STOP UPSERT (NaPTAN Access Nodes) =====
         This repository writes ONLY to BusStop.
         Do NOT point this at Station — Station is rail-only.
      ===== END BUS STOP UPSERT ===== */
      await prisma.busStop.upsert({
        where: { stopId: n.stopId },
        update: {
          name: n.name,
          indicator: n.indicator ?? null,
          latitude: n.latitude,
          longitude: n.longitude,
          localityId: n.localityId ?? null,
          stopType: n.stopType ?? null,
        },
        create: {
          stopId: n.stopId,
          name: n.name,
          indicator: n.indicator ?? null,
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