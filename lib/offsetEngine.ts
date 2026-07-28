import { Types } from 'mongoose';
import connectDB from './mongodb';
import OffsetFormulaVersion from './models/OffsetFormulaVersion';
import FeedBatch from './models/FeedBatch';
import FeedLog from './models/FeedLog';
import logger from './logger';

interface ActiveFormula {
  version: number;
  offsetPerCowPerDay: number;
}

export async function getActiveFormula(): Promise<ActiveFormula> {
  await connectDB();
  const formula = await OffsetFormulaVersion.findOne({ isActive: true }).lean<ActiveFormula>();
  if (!formula) {
    throw new Error('No active OffsetFormulaVersion found. Run scripts/seed-offset-formula-version.ts');
  }
  return { version: formula.version, offsetPerCowPerDay: formula.offsetPerCowPerDay };
}

async function getActiveFeedBatch(logDate: Date): Promise<Types.ObjectId | undefined> {
  await connectDB();
  const rangedBatch = await FeedBatch.findOne({
    activeFrom: { $lte: logDate },
    activeTo: { $gte: logDate },
  })
    .sort({ supplyDate: -1 })
    .lean<{ _id: Types.ObjectId }>();
  if (rangedBatch) return rangedBatch._id;

  const latestBatch = await FeedBatch.findOne({ supplyDate: { $lte: logDate } })
    .sort({ supplyDate: -1 })
    .lean<{ _id: Types.ObjectId }>();
  return latestBatch?._id;
}

function dayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fractionalOffsetId(farmerCustomId: string, cattleId: string, logDate: Date): string {
  const y = logDate.getFullYear();
  const m = String(logDate.getMonth() + 1).padStart(2, '0');
  const d = String(logDate.getDate()).padStart(2, '0');
  return `${farmerCustomId}_${y}${m}${d}_${cattleId}`;
}

interface FeedCheckParams {
  farmer: Types.ObjectId;
  farmerCustomId: string;
  cattle: Types.ObjectId;
  cattleId: string;
  logDate: Date;
}

export async function recordFeedGiven(params: FeedCheckParams): Promise<void> {
  await recordFeedGivenBatch([params]);
}

export async function recordFeedNotGiven(params: FeedCheckParams): Promise<void> {
  await recordFeedNotGivenBatch([params]);
}

export async function recordFeedGivenBatch(paramsList: FeedCheckParams[]): Promise<void> {
  if (paramsList.length === 0) return;
  await connectDB();
  const logDate = dayStart(paramsList[0].logDate);
  const formula = await getActiveFormula();
  const feedBatch = await getActiveFeedBatch(logDate);

  await FeedLog.bulkWrite(
    paramsList.map((params) => ({
      updateOne: {
        filter: { cattle: params.cattle, logDate },
        update: {
          $set: {
            farmer: params.farmer,
            cattle: params.cattle,
            feedBatch,
            logDate,
            feedGiven: true,
            status: 'VERIFIED',
            offsetValue: formula.offsetPerCowPerDay,
            formulaVersion: formula.version,
          },
          $setOnInsert: {
            fractionalOffsetId: fractionalOffsetId(params.farmerCustomId, params.cattleId, logDate),
          },
        },
        upsert: true,
      },
    }))
  );

  logger.info('Offset engine: feed given recorded (batch)', {
    count: paramsList.length,
    logDate: logDate.toISOString(),
    formulaVersion: formula.version,
  });
}

export async function recordFeedNotGivenBatch(paramsList: FeedCheckParams[]): Promise<void> {
  if (paramsList.length === 0) return;
  await connectDB();
  const logDate = dayStart(paramsList[0].logDate);

  await FeedLog.bulkWrite(
    paramsList.map((params) => ({
      updateOne: {
        filter: { cattle: params.cattle, logDate },
        update: {
          $set: {
            farmer: params.farmer,
            cattle: params.cattle,
            logDate,
            feedGiven: false,
            status: 'VERIFIED',
            offsetValue: 0,
          },
          $setOnInsert: {
            fractionalOffsetId: fractionalOffsetId(params.farmerCustomId, params.cattleId, logDate),
          },
        },
        upsert: true,
      },
    }))
  );

  logger.info('Offset engine: feed not given recorded (batch)', {
    count: paramsList.length,
    logDate: logDate.toISOString(),
  });
}
