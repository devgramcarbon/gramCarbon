import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import CarbonFarmer from '../lib/models/CarbonFarmer';
import Cattle from '../lib/models/Cattle';
import FeedBatch from '../lib/models/FeedBatch';
import CampLead from '../lib/models/CampLead';
import FeedLog from '../lib/models/FeedLog';
import Settings from '../lib/models/Settings';
import { encryptField } from '../lib/utils/encryption';

const OFFSET_PER_COW_PER_DAY = 0.001369863014; // 0.5 tCO2e/cow/year ÷ 365

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

const CSV_PATH = process.env.CSV_PATH || 'C:\\Users\\ABHISHEK\\Downloads\\Data OFFSET GramCarbon - Sheet4.csv';

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
  camp_lead_custom_id: string;
  camp_lead_lat: string;
  camp_lead_lng: string;
  log_date: string;
  feed_given: string;
  fractional_offset_id: string;
  verification_date: string;
  offset_value: string;
  note: string;
  offset_id: string;
  verified_lat: string;
  verified_lng: string;
  verification_pic: string;
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

// DD/MM/YYYY -> Date
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

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  await Settings.findOneAndUpdate(
    { key: 'carbon.offsetPerCowPerDay' },
    {
      $setOnInsert: {
        key: 'carbon.offsetPerCowPerDay',
        value: OFFSET_PER_COW_PER_DAY,
        category: 'carbon',
        label: 'Offset value per verified cow-day (tCO2e)',
        description: '0.5 tCO2e/cow/year divided by 365 days',
      },
    },
    { upsert: true }
  );

  console.log(`Reading CSV: ${CSV_PATH}`);
  const rows = parseCsv(CSV_PATH);
  console.log(`Parsed ${rows.length} rows`);

  // 1. Upsert farmers
  const farmerMap = new Map<string, string>(); // farmerCustomId -> ObjectId string
  const seenFarmers = new Map<string, CsvRow>();
  for (const row of rows) {
    if (!seenFarmers.has(row.farmer_custom_id)) {
      seenFarmers.set(row.farmer_custom_id, row);
    }
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
    farmerMap.set(farmerCustomId, String(doc._id));
  }

  // 2. Upsert cattle
  const cattleMap = new Map<string, string>();
  const seenCattle = new Map<string, string>(); // cattleId -> farmerCustomId
  for (const row of rows) {
    if (!seenCattle.has(row.cattle_id)) {
      seenCattle.set(row.cattle_id, row.farmer_custom_id);
    }
  }
  console.log(`Upserting ${seenCattle.size} cattle...`);
  for (const [cattleId, farmerCustomId] of seenCattle) {
    const doc = await Cattle.findOneAndUpdate(
      { cattleId },
      { $setOnInsert: { cattleId, farmer: farmerMap.get(farmerCustomId) } },
      { upsert: true, new: true }
    );
    cattleMap.set(cattleId, String(doc._id));
  }

  // 3. Upsert feed batches
  const feedBatchMap = new Map<string, string>();
  const seenBatches = new Set(rows.map((r) => r.feed_batch_id).filter(Boolean));
  console.log(`Upserting ${seenBatches.size} feed batches...`);
  for (const feedBatchId of seenBatches) {
    const doc = await FeedBatch.findOneAndUpdate(
      { feedBatchId },
      { $setOnInsert: { feedBatchId } },
      { upsert: true, new: true }
    );
    feedBatchMap.set(feedBatchId, String(doc._id));
  }

  // 4. Upsert camp leads (only present if data has them)
  const campLeadMap = new Map<string, string>();
  const seenCampLeads = new Set(rows.map((r) => r.camp_lead_custom_id).filter(Boolean));
  if (seenCampLeads.size > 0) {
    console.log(`Upserting ${seenCampLeads.size} camp leads...`);
    for (const campLeadCustomId of seenCampLeads) {
      const row = rows.find((r) => r.camp_lead_custom_id === campLeadCustomId)!;
      const doc = await CampLead.findOneAndUpdate(
        { campLeadCustomId },
        {
          $setOnInsert: {
            campLeadCustomId,
            location:
              row.camp_lead_lat && row.camp_lead_lng
                ? { lat: Number(row.camp_lead_lat), lng: Number(row.camp_lead_lng) }
                : undefined,
          },
        },
        { upsert: true, new: true }
      );
      campLeadMap.set(campLeadCustomId, String(doc._id));
    }
  }

  // 5. Bulk insert feed logs
  console.log('Building feed log documents...');
  const feedLogDocs = rows.map((row) => {
    const doc: Record<string, unknown> = {
      farmer: farmerMap.get(row.farmer_custom_id),
      cattle: cattleMap.get(row.cattle_id),
      feedBatch: feedBatchMap.get(row.feed_batch_id),
      logDate: parseDdMmYyyy(row.log_date),
      feedGiven: row.feed_given?.toLowerCase() === 'yes',
      fractionalOffsetId: row.fractional_offset_id,
      status: row.verification_date ? 'VERIFIED' : 'PENDING',
      offsetValue: row.offset_value ? Number(row.offset_value) : null,
    };

    if (row.verification_date || row.camp_lead_custom_id || row.verified_lat) {
      doc.verification = {
        campLead: campLeadMap.get(row.camp_lead_custom_id),
        verificationDate: parseDateTime(row.verification_date),
        verifiedLat: row.verified_lat ? Number(row.verified_lat) : undefined,
        verifiedLng: row.verified_lng ? Number(row.verified_lng) : undefined,
        verificationPic: row.verification_pic || undefined,
        note: row.note || undefined,
      };
    }

    return doc;
  });

  console.log(`Inserting ${feedLogDocs.length} feed logs in batches...`);
  const BATCH_SIZE = 2000;
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < feedLogDocs.length; i += BATCH_SIZE) {
    const batch = feedLogDocs.slice(i, i + BATCH_SIZE);
    try {
      const result = await FeedLog.insertMany(batch, { ordered: false });
      inserted += result.length;
    } catch (err) {
      const bulkErr = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
      inserted += bulkErr.insertedDocs?.length ?? 0;
      skipped += bulkErr.writeErrors?.length ?? 0;
    }
    console.log(`  ...${Math.min(i + BATCH_SIZE, feedLogDocs.length)}/${feedLogDocs.length}`);
  }

  console.log(`\nDone. Feed logs inserted: ${inserted}, skipped (duplicates/errors): ${skipped}`);
  console.log(`Farmers: ${farmerMap.size}, Cattle: ${cattleMap.size}, Feed batches: ${feedBatchMap.size}, Camp leads: ${campLeadMap.size}`);

  await mongoose.disconnect();
}

run().catch((err: Error) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
