require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const statsPath = path.join(__dirname, 'models', 'historical_stats.json');
  if (!fs.existsSync(statsPath)) {
    console.error('historical_stats.json not found at', statsPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(statsPath, 'utf-8');
  const cleaned = raw.replace(/\bNaN\b/g, 'null');
  const stats = JSON.parse(cleaned);

  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(stats)).digest('hex');

  const sourceId = 'ai:historical_stats';
  const operatorId = 'AI_STATS';
  const routeId = 'AI_STATS_AGG';

  const meta = stats.metadata || {};
  const overallLate = Number(meta.overall_late_ratio || 0);
  let score = Math.round((1.0 - overallLate) * 100.0);
  score = Math.max(1, Math.min(100, score));
  let confidence = 'LOW';
  const totalRecords = Number(meta.total_records || 0);
  if (totalRecords > 10000) confidence = 'HIGH';
  else if (totalRecords > 1000) confidence = 'MEDIUM';

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // 1) Upsert a DataSource for these AI stats
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

    await prisma.route.upsert({
      where: { routeId },
      update: { mode: 'RAIL', operatorId, updatedAt: new Date() },
      create: { routeId, mode: 'RAIL', operatorId },
    });

    const existing = await prisma.externalRouteSnapshot.findFirst({
      where: { routeId, sourceId: ds.sourceId, payloadHash },
    });

    if (existing) {
      console.log('Snapshot already exists, skipping create. snapshotId=', existing.snapshotId);
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
      console.log('Created ExternalRouteSnapshot:', snap.snapshotId);
    }

    const rs = await prisma.reliabilityScore.create({
      data: {
        routeId,
        score: score / 1.0,
        confidenceLevel: confidence,
      },
    });
    console.log('Created ReliabilityScore:', rs.scoreId, 'score=', rs.score, 'confidence=', rs.confidenceLevel);

    console.log('Done. DataSource:', ds.sourceId, 'Route:', routeId);

  } catch (err) {
    console.error('ERROR seeding AI stats:', err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
