import mongoose from 'mongoose';
import Settings from '../lib/models/Settings';
import OffsetFormulaVersion from '../lib/models/OffsetFormulaVersion';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI!);

  const existingActive = await OffsetFormulaVersion.findOne({ isActive: true });
  if (existingActive) {
    console.log(`Active formula version already exists: v${existingActive.version} (${existingActive.offsetPerCowPerDay} tCO2e/cow/day). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const settingsValue = await Settings.findOne({ key: 'carbon.offsetPerCowPerDay' }).lean<{ value?: number }>();
  const offsetPerCowPerDay = settingsValue?.value ?? 0.68 / 365;

  const doc = await OffsetFormulaVersion.create({
    version: 1,
    offsetPerCowPerDay,
    label: 'Initial flat rate — 0.68 tCO2e/cow/year',
    effectiveFrom: new Date(),
    isActive: true,
  });

  console.log(`Seeded OffsetFormulaVersion v${doc.version}: ${doc.offsetPerCowPerDay} tCO2e/cow/day (active).`);

  await mongoose.disconnect();
}

run().catch((err: Error) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
