import mongoose from 'mongoose';
import Settings from '../lib/models/Settings';
import FeedBatch from '../lib/models/FeedBatch';
import FeedLog from '../lib/models/FeedLog';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

const OFFSET_PER_COW_PER_DAY = 0.68 / 365; // 0.68 tCO2e/cow/year

const FEED_BATCHES = [
  {
    feedBatchId: 'ZEC_MCC_B0725/01',
    supplyDate: new Date('2025-07-01'),
    gramsPerAnimalPerDay: 80,
    totalKg: 265,
    activeFrom: new Date('2025-07-07'),
    activeTo: new Date('2025-08-07'),
  },
  {
    feedBatchId: 'ZEC_MCC_B0825/02',
    supplyDate: new Date('2025-08-14'),
    gramsPerAnimalPerDay: 100,
  },
  {
    feedBatchId: 'ZEC_MCC_B0925/03',
    supplyDate: new Date('2025-09-12'),
    gramsPerAnimalPerDay: 100,
  },
  {
    feedBatchId: 'ZEC_MCC_B0126/04',
    supplyDate: new Date('2026-01-01'),
    gramsPerAnimalPerDay: 120,
  },
  {
    feedBatchId: 'ZEC_MCC_B0726/05',
    supplyDate: new Date('2026-07-25'),
  },
];

async function run() {
  await mongoose.connect(MONGODB_URI!);

  console.log('Updating offset constant to 0.68 tCO2e/cow/year...');
  await Settings.findOneAndUpdate(
    { key: 'carbon.offsetPerCowPerDay' },
    {
      $set: {
        value: OFFSET_PER_COW_PER_DAY,
        category: 'carbon',
        label: 'Offset value per verified cow-day (tCO2e)',
        description: '0.68 tCO2e/cow/year divided by 365 days',
      },
    },
    { upsert: true }
  );

  console.log('Populating feed batch metadata...');
  for (const batch of FEED_BATCHES) {
    const { feedBatchId, ...rest } = batch;
    await FeedBatch.findOneAndUpdate({ feedBatchId }, { $set: rest }, { upsert: true });
    console.log(`  ${feedBatchId} updated`);
  }

  console.log('Recalculating offsetValue on all feed-given FeedLogs...');
  const result = await FeedLog.updateMany(
    { feedGiven: true },
    { $set: { offsetValue: OFFSET_PER_COW_PER_DAY } }
  );
  console.log(`  Updated ${result.modifiedCount} FeedLogs`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err: Error) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
