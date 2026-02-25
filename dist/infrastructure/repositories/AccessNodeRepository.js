"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessNodeRepository = void 0;
const client_1 = require("../orm/prisma/client");
class AccessNodeRepository {
    async upsertMany(nodes) {
        let count = 0;
        for (const n of nodes) {
            await client_1.prisma.station.upsert({
                where: { stationId: n.stationId },
                update: {
                    name: n.name,
                    latitude: n.latitude ?? 0,
                    longitude: n.longitude ?? 0,
                    // If your Station table has localityId/stopType fields, set them here.
                },
                create: {
                    stationId: n.stationId,
                    name: n.name,
                    latitude: n.latitude ?? 0,
                    longitude: n.longitude ?? 0,
                },
            });
            count++;
        }
        return count;
    }
}
exports.AccessNodeRepository = AccessNodeRepository;
