"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../infrastructure/orm/prisma/client");
async function main() {
    await client_1.prisma.dataSource.upsert({
        where: { sourceId: "transport-server" },
        update: { enabled: true },
        create: {
            sourceId: "transport-server",
            name: "Transport SCC Server",
            baseUrl: process.env.TRANSPORT_SERVER_BASE_URL ?? null,
            enabled: true,
        },
    });
    console.log("Seeded DataSource: transport-server");
}
main()
    .catch(console.error)
    .finally(async () => client_1.prisma.$disconnect());
