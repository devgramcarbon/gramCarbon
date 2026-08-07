import mongoose from 'mongoose';
import fs from 'fs';
import MmMonthlyData from '../lib/models/MmMonthlyData';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

const CSV_PATH = process.env.CSV_PATH || 'C:\\Users\\ABHISHEK\\Downloads\\MM data from Oct to June 2026 - Sheet1.csv';

const MONTH_NAME_TO_NUM: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

// Fiscal year: Oct-Dec -> 2025, Jan-Jun -> 2026 (per source sheet: "Oct to June 2026")
function yearForMonth(monthNum: number): number {
  return monthNum >= 10 ? 2025 : 2026;
}

function num(v: string): number {
  const n = parseFloat((v || '').replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

interface CsvRecord {
  monthLabel: string;
  mccCode: string;
  mccName: string;
  quantityPerDay: string;
  noOfProducers: string;
  noOfProducersUsingCH4OW: string;
  milkQuantityPerDayLit: string;
  totalMonthlyCollectionLit: string;
  fatPercent: string;
  snfPercent: string;
  noOfAnimals: string;
  productivityPerDayPerCow: string;
  tonsLowCarbonFeed: string;
  fractionalCreditsGenerated: string;
  cc: string;
  isSummaryRow?: boolean;
}

function parseCsv(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const records: CsvRecord[] = [];

  for (const line of lines) {
    const cols = line.split(',');
    const monthLabel = (cols[1] || '').trim();

    // Sheet's own "Total / Average" row — authoritative aggregate that doesn't
    // necessarily equal a straight sum of the per-MCC rows above it.
    if (monthLabel === 'Total / Average') {
      records.push({
        monthLabel,
        mccCode: 'TOTAL',
        mccName: 'Total / Average',
        quantityPerDay: cols[4],
        noOfProducers: cols[5],
        noOfProducersUsingCH4OW: cols[7],
        milkQuantityPerDayLit: cols[8],
        totalMonthlyCollectionLit: cols[9],
        fatPercent: cols[10],
        snfPercent: cols[11],
        noOfAnimals: cols[12],
        productivityPerDayPerCow: cols[13],
        tonsLowCarbonFeed: cols[14],
        fractionalCreditsGenerated: cols[15],
        cc: cols[16],
        isSummaryRow: true,
      });
      continue;
    }

    const mccCode = (cols[2] || '').trim();
    if (!monthLabel || !MONTH_NAME_TO_NUM[monthLabel] || !mccCode) continue;

    records.push({
      monthLabel,
      mccCode,
      mccName: (cols[3] || '').trim(),
      quantityPerDay: cols[4],
      noOfProducers: cols[5],
      noOfProducersUsingCH4OW: cols[7],
      milkQuantityPerDayLit: cols[8],
      totalMonthlyCollectionLit: cols[9],
      fatPercent: cols[10],
      snfPercent: cols[11],
      noOfAnimals: cols[12],
      productivityPerDayPerCow: cols[13],
      tonsLowCarbonFeed: cols[14],
      fractionalCreditsGenerated: cols[15],
      cc: cols[16],
    });
  }
  return records;
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  console.log(`Reading CSV: ${CSV_PATH}`);
  const rows = parseCsv(CSV_PATH);
  console.log(`Parsed ${rows.length} MCC-month rows`);

  let upserted = 0;
  for (const row of rows) {
    const isSummaryRow = !!row.isSummaryRow;
    const month = isSummaryRow ? 0 : MONTH_NAME_TO_NUM[row.monthLabel];
    const year = isSummaryRow ? 0 : yearForMonth(month);

    await MmMonthlyData.findOneAndUpdate(
      { year, month, mccCode: row.mccCode },
      {
        $set: {
          year,
          month,
          monthLabel: row.monthLabel,
          mccCode: row.mccCode,
          mccName: row.mccName,
          quantityPerDay: num(row.quantityPerDay),
          noOfProducers: num(row.noOfProducers),
          noOfProducersUsingCH4OW: num(row.noOfProducersUsingCH4OW),
          milkQuantityPerDayLit: num(row.milkQuantityPerDayLit),
          totalMonthlyCollectionLit: num(row.totalMonthlyCollectionLit),
          fatPercent: num(row.fatPercent),
          snfPercent: num(row.snfPercent),
          noOfAnimals: num(row.noOfAnimals),
          productivityPerDayPerCow: num(row.productivityPerDayPerCow),
          tonsLowCarbonFeed: num(row.tonsLowCarbonFeed),
          fractionalCreditsGenerated: num(row.fractionalCreditsGenerated),
          cc: num(row.cc),
          isSummaryRow,
        },
      },
      { upsert: true }
    );
    upserted++;
  }

  console.log(`\nDone. Upserted ${upserted} MCC-month records.`);
  await mongoose.disconnect();
}

run().catch((err: Error) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
