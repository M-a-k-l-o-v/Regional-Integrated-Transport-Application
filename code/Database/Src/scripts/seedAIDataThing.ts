import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const statsPath = path.join(__dirname, '../seeds/historical_stats.json');

async function main() {
  const raw = fs.readFileSync(statsPath, 'utf-8');
  const cleaned = raw.replace(/\bNaN\b/g, 'null');
  const stats = JSON.parse(cleaned);

  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(stats))
    .digest('hex');

  const sourceId = 'ai:historical_stats';
  const operatorId = 'AI_STATS';
  const routeId = 'AI_STATS_AGG';

  const meta = stats.metadata || {};
  const overallLate = Number(meta.overall_late_ratio || 0);
  let score = Math.round((1.0 - overallLate) * 100.0);
  score = Math.max(1, Math.min(100, score));

  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  const totalRecords = Number(meta.total_records || 0);
  if (totalRecords > 10000) confidence = 'HIGH';
  else if (totalRecords > 1000) confidence = 'MEDIUM';

  try {
    const ds = await prisma.dataSource.upsert({
      where: { sourceId },
      update: { name: 'AI Historical Stats', lastPayloadHash: payloadHash, updatedAt: new Date() },
      create: { sourceId, name: 'AI Historical Stats', enabled: true, lastPayloadHash: payloadHash },
    });

    await prisma.operator.upsert({
      where: { operatorId },
      update: { name: 'AI Stats Operator', updatedAt: new Date() },
      create: { operatorId, name: 'AI Stats Operator' },
    });

    await prisma.busRoute.upsert({
      where: { routeId },
      update: { mode: 'RAIL', operatorId, updatedAt: new Date() },
      create: { routeId, mode: 'RAIL', operatorId },
    });

    const existing = await prisma.externalRouteSnapshot.findFirst({
      where: { routeId, sourceId: ds.sourceId, payloadHash },
    });

    if (existing) {
      console.log('snapshot exists... Skipping...');
    } else {
      const snap = await prisma.externalRouteSnapshot.create({
        data: {
          routeId,
          sourceId: ds.sourceId,
          externalRouteKey: 'ai:historical_stats_snapshot',
          retrievedAt: new Date(),
          payloadHash,
          normalisedJson: stats,
        },
      });
      console.log('Created  ', snap.snapshotId);
    }

    const rs = await prisma.reliabilityScore.create({
      data: {
        routeId,
        score: score / 1.0,
        confidenceLevel: confidence,
      },
    });

  } catch (err: any) {
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}