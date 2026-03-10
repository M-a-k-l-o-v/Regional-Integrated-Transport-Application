import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./infrastructure/orm/prisma/client";
import { startCronJobs } from "./cronJobs";

async function main() {
  // Confirm DB connectivity early
  await prisma.$connect();

  const app = createApp();

  // Start cron jobs (Role 1)
  startCronJobs();

  app.listen(env.PORT, () => {
    console.log(`Backend running on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});