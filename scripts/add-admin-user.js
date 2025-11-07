import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually if it exists
try {
  const envPath = join(__dirname, '..', '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (error) {
  // .env file doesn't exist or can't be read, rely on system env vars
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set. Please set it in your .env file or environment variables.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addAdminUser() {
  const email = 'admin@localpos.com';
  const password = 'Abcd1234';
  const username = email; // Use email as username
  const fullName = 'Admin User';
  const role = 'admin';

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️  User already exists:');
      console.log(`   Username: ${existingUser.rows[0].username}`);
      console.log(`   Email: ${existingUser.rows[0].email}`);
      console.log('   Use a different email/username or update the existing user.');
      client.release();
      await pool.end();
      process.exit(1);
    }

    // Hash the password
    console.log('Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    // Insert the user
    console.log('Creating admin user...');
    const result = await client.query(
      `INSERT INTO users (username, password, full_name, email, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, full_name, role, is_active, created_at`,
      [username, hashedPassword, fullName, email, role, 'true']
    );

    const user = result.rows[0];
    console.log('\n✅ Admin user created successfully!');
    console.log('\nUser details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Full Name: ${user.full_name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`\n📧 Login credentials:`);
    console.log(`   Email/Username: ${email}`);
    console.log(`   Password: ${password}`);

    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    if (error.code === '23505') {
      console.error('   Error: Username or email already exists');
    }
    process.exit(1);
  }
}

addAdminUser();

