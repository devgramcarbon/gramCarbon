import fs from 'fs';
import { Types } from 'mongoose';
import connectDB from '../lib/mongodb';
import Farmer from '../lib/models/Farmer';
import CarbonFarmer from '../lib/models/CarbonFarmer';
import Cattle from '../lib/models/Cattle';
import FeedBatch from '../lib/models/FeedBatch';
import OffsetFormulaVersion from '../lib/models/OffsetFormulaVersion';
import { encryptField } from '../lib/utils/encryption';
import { recordFeedGivenBatch, recordFeedNotGivenBatch } from '../lib/offsetEngine';

const CSV_PATH =
  process.env.CSV_PATH ||
  'C:\\Users\\ABHISHEK\\Downloads\\GramCarbon NP data till 31st March 2026 - Sheet4.csv';

interface CsvRow {
  farmer_custom_id: string;
  farmer_name: string;
  aadhar: string;
  mobile_number: string;
  farmer_lat: string;
  farmer_lng: string;
  place: string;
  state: string;
  district: string;
  pincode: string;
  farmer_onboarding_date: string;
  cattle_id: string;
  feed_batch_id: string;
  log_date: string;
  feed_given: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

// DD/MM/YYYY -> UTC Date (day start)
function parseDdMmYyyy(s: string): Date | undefined {
  if (!s) return undefined;
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y) return undefined;
  return new Date(Date.UTC(y, m - 1, d));
}

// "YYYY-MM-DD HH:mm:ss" -> Date
function parseDateTime(s: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? undefined : d;
}

async function ensureActiveFormula(): Promise<void> {
  const existing = await OffsetFormulaVersion.findOne({ isActive: true });
  if (existing) {
    console.log(`Active formula already set: v${existing.version} (${existing.offsetPerCowPerDay} tCO2e/cow/day).`);
    return;
  }
  const doc = await OffsetFormulaVersion.create({
    version: 1,
    offsetPerCowPerDay: 0.68 / 365,
    label: 'Initial flat rate — 0.68 tCO2e/cow/year',
    effectiveFrom: new Date(),
    isActive: true,
  });
  console.log(`Seeded OffsetFormulaVersion v${doc.version}: ${doc.offsetPerCowPerDay} tCO2e/cow/day (active).`);
}

async function run() {
  await connectDB();
  await ensureActiveFormula();

  console.log(`Reading CSV: ${CSV_PATH}`);
  const rows = parseCsv(CSV_PATH);
  console.log(`Parsed ${rows.length} rows`);

  // 1. Upsert farmers
  const farmerMap = new Map<string, Types.ObjectId>();
  const seenFarmers = new Map<string, CsvRow>();
  for (const row of rows) {
    if (!seenFarmers.has(row.farmer_custom_id)) seenFarmers.set(row.farmer_custom_id, row);
  }
  console.log(`Upserting ${seenFarmers.size} farmers...`);
  for (const [farmerCustomId, row] of seenFarmers) {
    const doc = await CarbonFarmer.findOneAndUpdate(
      { farmerCustomId },
      {
        $setOnInsert: {
          farmerCustomId,
          name: row.farmer_name,
          aadharEncrypted: row.aadhar ? encryptField(row.aadhar) : undefined,
          mobile: row.mobile_number || undefined,
          location:
            row.farmer_lat && row.farmer_lng
              ? { lat: Number(row.farmer_lat), lng: Number(row.farmer_lng) }
              : undefined,
          place: row.place || undefined,
          state: row.state || undefined,
          district: row.district || undefined,
          pincode: row.pincode || undefined,
          onboardingDate: parseDateTime(row.farmer_onboarding_date),
          programSite: 'NAINARPALAYAM',
        },
      },
      { upsert: true, new: true }
    );
    farmerMap.set(farmerCustomId, doc._id as Types.ObjectId);
  }

  // 2. Upsert cattle
  const cattleMap = new Map<string, Types.ObjectId>();
  const seenCattle = new Map<string, string>(); // cattleId -> farmerCustomId
  for (const row of rows) {
    if (!seenCattle.has(row.cattle_id)) seenCattle.set(row.cattle_id, row.farmer_custom_id);
  }

  // 2b. Upsert the general Farmer directory record (what /dashboard/farmers reads),
  //     keyed to the same custom ID so it's linked 1:1 with the CarbonFarmer record.
  const cattleCountByFarmer = new Map<string, number>();
  for (const farmerCustomId of seenCattle.values()) {
    cattleCountByFarmer.set(farmerCustomId, (cattleCountByFarmer.get(farmerCustomId) ?? 0) + 1);
  }
  console.log(`Upserting ${seenFarmers.size} Farmer directory records...`);
  for (const [farmerCustomId, row] of seenFarmers) {
    await Farmer.findOneAndUpdate(
      { farmerId: farmerCustomId },
      {
        $setOnInsert: {
          farmerId: farmerCustomId,
          name: row.farmer_name,
          mobile: row.mobile_number,
          village: row.place || undefined,
          district: row.district || undefined,
          state: row.state || undefined,
          animalCount: cattleCountByFarmer.get(farmerCustomId) ?? 1,
          animalType: 'Cow',
          project: 'np',
        },
      },
      { upsert: true, new: true }
    );
  }
  console.log(`Upserting ${seenCattle.size} cattle...`);
  for (const [cattleId, farmerCustomId] of seenCattle) {
    const doc = await Cattle.findOneAndUpdate(
      { cattleId },
      { $setOnInsert: { cattleId, farmer: farmerMap.get(farmerCustomId) } },
      { upsert: true, new: true }
    );
    cattleMap.set(cattleId, doc._id as Types.ObjectId);
  }

  // 3. Upsert feed batches with date ranges so offsetEngine can resolve the right batch per log date
  const batchRanges = new Map<string, { min: Date; max: Date }>();
  for (const row of rows) {
    const d = parseDdMmYyyy(row.log_date);
    if (!row.feed_batch_id || !d) continue;
    const existing = batchRanges.get(row.feed_batch_id);
    if (!existing) {
      batchRanges.set(row.feed_batch_id, { min: d, max: d });
    } else {
      if (d < existing.min) existing.min = d;
      if (d > existing.max) existing.max = d;
    }
  }
  console.log(`Upserting ${batchRanges.size} feed batches...`);
  for (const [feedBatchId, range] of batchRanges) {
    await FeedBatch.findOneAndUpdate(
      { feedBatchId },
      {
        $setOnInsert: {
          feedBatchId,
          supplyDate: range.min,
          activeFrom: range.min,
          activeTo: range.max,
        },
      },
      { upsert: true, new: true }
    );
  }

  // 4. Group rows by log date, then record via the shared offset engine
  //    (same functions the WhatsApp flow will call), split by feed_given yes/no.
  const rowsByDate = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const key = row.log_date;
    if (!key) continue;
    if (!rowsByDate.has(key)) rowsByDate.set(key, []);
    rowsByDate.get(key)!.push(row);
  }

  console.log(`Recording feed logs across ${rowsByDate.size} distinct dates...`);
  let processedDates = 0;
  for (const [dateStr, dateRows] of rowsByDate) {
    const logDate = parseDdMmYyyy(dateStr)!;
    const given = dateRows.filter((r) => r.feed_given?.toLowerCase() === 'yes');
    const notGiven = dateRows.filter((r) => r.feed_given?.toLowerCase() !== 'yes');

    const toParams = (r: CsvRow) => ({
      farmer: farmerMap.get(r.farmer_custom_id)!,
      farmerCustomId: r.farmer_custom_id,
      cattle: cattleMap.get(r.cattle_id)!,
      cattleId: r.cattle_id,
      logDate,
    });

    if (given.length > 0) await recordFeedGivenBatch(given.map(toParams));
    if (notGiven.length > 0) await recordFeedNotGivenBatch(notGiven.map(toParams));

    processedDates++;
    if (processedDates % 30 === 0) {
      console.log(`  ...${processedDates}/${rowsByDate.size} dates`);
    }
  }

  console.log(`\nDone. Farmers: ${farmerMap.size}, Cattle: ${cattleMap.size}, Feed batches: ${batchRanges.size}, Dates processed: ${rowsByDate.size}`);
  process.exit(0);
}

run().catch((err: Error) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
