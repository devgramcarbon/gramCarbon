import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set.');
  process.exit(1);
}

const BusinessContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    org: { type: String, enum: ['MILKY_MIST', 'ZEROEARTH'], required: true },
    department: { type: String, enum: ['PRODUCTION', 'ACCOUNTS'], required: true },
    phone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
BusinessContactSchema.index({ org: 1, department: 1 }, { unique: true });

const CONTACTS = [
  { name: 'MM Prod', org: 'MILKY_MIST', department: 'PRODUCTION', phone: '917907247909' },
  { name: 'MM Acc', org: 'MILKY_MIST', department: 'ACCOUNTS', phone: '917907247909' },
  { name: 'ZE Prod', org: 'ZEROEARTH', department: 'PRODUCTION', phone: '917907247909' },
  { name: 'ZE Acc', org: 'ZEROEARTH', department: 'ACCOUNTS', phone: '917907247909' },
];

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  const BusinessContact =
    mongoose.models.BusinessContact || mongoose.model('BusinessContact', BusinessContactSchema);

  for (const contact of CONTACTS) {
    const result = await BusinessContact.findOneAndUpdate(
      { org: contact.org, department: contact.department },
      { $set: contact },
      { upsert: true, new: true }
    );
    console.log(`✅ ${result.name} (${result.org}/${result.department}) → ${result.phone}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err: Error) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
