import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pool } from 'pg';

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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = join(__dirname, '..', 'migrations', '0000_overrated_khan.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split by statement breakpoint and execute each statement
    // The migration file uses '--> statement-breakpoint' as a separator
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && part.startsWith('CREATE TABLE'))
      .map(statement => {
        // Ensure statement ends with semicolon
        return statement.endsWith(';') ? statement : statement + ';';
      });

    console.log(`\nApplying ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        try {
          await client.query(statement);
          const tableMatch = statement.match(/CREATE TABLE "?(\w+)"?/i);
          const tableName = tableMatch ? tableMatch[1] : 'unknown';
          console.log(`✅ Statement ${i + 1}/${statements.length} applied (${tableName})`);
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists') || error.code === '42P07' || error.code === '23505') {
            const tableMatch = statement.match(/CREATE TABLE "?(\w+)"?/i);
            const tableName = tableMatch ? tableMatch[1] : 'unknown';
            console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped - ${tableName} already exists`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            console.error('Statement:', statement.substring(0, 100) + '...');
            throw error;
          }
        }
      }
    }

    client.release();
    console.log('\n✅ Migration applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
