import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set.');
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  { name: String, email: { type: String, unique: true }, password: String, role: String, isActive: Boolean, lastLogin: Date },
  { timestamps: true }
);

async function backfill() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const updates: Array<{ email: string; role: string }> = [
    { email: 'admin@gmail.com', role: 'ZE_ADMIN' },
    { email: 'accounts@gmail.com', role: 'ZE_ACC' },
  ];

  for (const { email, role } of updates) {
    const res = await User.updateOne({ email }, { role });
    console.log(res.matchedCount ? `✅ ${email} → ${role}` : `⚠️  ${email} not found`);
  }

  await mongoose.disconnect();
}

backfill().catch((err: Error) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
