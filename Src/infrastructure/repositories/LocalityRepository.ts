import { prisma } from "../orm/prisma/client";
import type { NormalisedLocality } from "../../ingestion/normalisers/localitiesNormaliser";

export class LocalityRepository {
  async upsertMany(localities: NormalisedLocality[]): Promise<number> {
    let count = 0;
    for (const l of localities) {
      await prisma.locality.upsert({
        where: { localityId: l.localityId },
        update: {
          name: l.name,
          parentId: l.parentId ?? null,
          latitude: l.latitude ?? null,
          longitude: l.longitude ?? null,
        },
        create: {
          localityId: l.localityId,
          name: l.name,
          parentId: l.parentId ?? null,
          latitude: l.latitude ?? null,
          longitude: l.longitude ?? null,
        },
      });
      count++;
    }
    return count;
  }
}