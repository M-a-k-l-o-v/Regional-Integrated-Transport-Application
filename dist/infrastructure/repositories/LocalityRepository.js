"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalityRepository = void 0;
const client_1 = require("../orm/prisma/client");
class LocalityRepository {
    async upsertMany(localities) {
        let count = 0;
        for (const l of localities) {
            await client_1.prisma.locality.upsert({
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
exports.LocalityRepository = LocalityRepository;
