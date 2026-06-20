import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set.');
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  { name: String, email: { type: String, unique: true }, password: String, role: String, isActive: Boolean, lastLogin: Date },
  { timestamps: true }
);

async function reset() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  const email = process.env.SEED_EMAIL || 'admin@gramcarbon.in';
  const password = process.env.SEED_PASSWORD || 'admin@123';

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`❌ User ${email} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await User.updateOne({ email }, { password: hashedPassword, isActive: true, role: 'SUPER_ADMIN' });

  console.log(`✅ Password reset for ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   isActive: true`);
  console.log(`   role: SUPER_ADMIN`);

  await mongoose.disconnect();
}

reset().catch((err: Error) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
