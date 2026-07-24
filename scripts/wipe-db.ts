import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

// users collection holds admin accounts - must be preserved
const PRESERVE = new Set(['users']);

async function wipe() {
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db!;

  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    if (PRESERVE.has(name)) {
      console.log(`Preserved: ${name}`);
      continue;
    }
    const result = await db.collection(name).deleteMany({});
    console.log(`Wiped ${name}: ${result.deletedCount} docs removed`);
  }

  console.log('\nWipe complete. Admin users preserved.');
  await mongoose.disconnect();
}

wipe().catch((err: Error) => {
  console.error('Wipe failed:', err.message);
  process.exit(1);
});
