import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

async function backup() {
  await mongoose.connect(MONGODB_URI!);
  const db = mongoose.connection.db!;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'backups', timestamp);
  fs.mkdirSync(outDir, { recursive: true });

  const collections = await db.listCollections().toArray();

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    fs.writeFileSync(
      path.join(outDir, `${name}.json`),
      JSON.stringify(docs, null, 2)
    );
    console.log(`Backed up ${name}: ${docs.length} docs`);
  }

  console.log(`\nBackup complete: ${outDir}`);
  await mongoose.disconnect();
}

backup().catch((err: Error) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
