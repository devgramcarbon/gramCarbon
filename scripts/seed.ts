import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set. Create .env.local first.');
  process.exit(1);
}

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: String,
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
  },
  { timestamps: true }
);

async function seed() {
  console.log('🌱 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);

  const User = mongoose.models.User || mongoose.model('User', UserSchema);

  const email = process.env.SEED_EMAIL || 'admin@gramcarbon.in';
  const password = process.env.SEED_PASSWORD || 'admin@123';
  const name = process.env.SEED_NAME || 'Super Admin';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`⚠️  User ${email} already exists. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await User.create({ name, email, password: hashedPassword, role: 'SUPER_ADMIN', isActive: true });

  console.log('✅ Super Admin created:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('   ⚠️  Change the password after first login!');

  await mongoose.disconnect();
}

seed().catch((err: Error) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
