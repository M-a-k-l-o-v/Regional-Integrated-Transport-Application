"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const client_1 = require("./infrastructure/orm/prisma/client");
const cronJobs_1 = require("./cronJobs");
async function main() {
    // Confirm DB connectivity early
    await client_1.prisma.$connect();
    const app = (0, app_1.createApp)();
    // Start cron jobs (Role 1)
    (0, cronJobs_1.startCronJobs)();
    app.listen(env_1.env.PORT, () => {
        console.log(`Backend running on http://localhost:${env_1.env.PORT}`);
    });
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
