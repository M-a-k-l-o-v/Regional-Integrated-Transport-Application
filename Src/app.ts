import express from "express";
import cors from "cors";
import { prisma } from "./infrastructure/orm/prisma/client";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ message: "Backend is running" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // AI Stats
  app.get("/api/ai-stats", async (_req, res) => {
    try {
      const aiRoute = await prisma.route.findFirst({
        where: { routeId: "AI_STATS_AGG" },
        include: {
          reliabilityScores: {
            orderBy: { calculatedAt: "desc" },
            take: 1,
          },
          snapshots: {
            where: { sourceId: "ai:historical_stats" },
            orderBy: { retrievedAt: "desc" },
            take: 1,
          },
        },
      });

      if (!aiRoute) {
        return res.status(404).json({ error: "AI stats not found" });
      }

      const latestScore = aiRoute.reliabilityScores[0];
      const latestSnapshot = aiRoute.snapshots[0];

      res.json({
        route: aiRoute,
        reliabilityScore: latestScore,
        snapshot: latestSnapshot,
      });
    } catch (error) {
      console.error("Error fetching AI stats:", error);
      res.status(500).json({ error: "Failed to fetch AI stats" });
    }
  });

  return app;
}