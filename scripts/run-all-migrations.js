import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env files manually
function loadEnvFile(filePath) {
  try {
    const envFile = readFileSync(filePath, 'utf-8');
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
    // File doesn't exist, ignore
  }
}

loadEnvFile(join(__dirname, '..', '.env'));
loadEnvFile(join(__dirname, '..', '.env.production'));

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// When MIGRATION_QUIET=1, skip logging "already exists" / "skipping" messages (reduces log noise on re-runs)
const QUIET = process.env.MIGRATION_QUIET === '1';
function logSkip(msg) {
  if (!QUIET) console.log(msg);
}

async function executeSQL(client, sql, description) {
  try {
    await client.query(sql);
    console.log(`✅ ${description}`);
    return true;
  } catch (error) {
    // Check if it's an "already exists" error
    if (
      error.code === '42P07' || // relation already exists
      error.code === '23505' || // unique constraint violation
      error.code === '42710' || // duplicate object
      error.code === '42723' || // function already exists
      error.message.includes('already exists') ||
      error.message.includes('duplicate key') ||
      error.message.includes('duplicate')
    ) {
      logSkip(`⚠️  ${description} - already exists, skipping`);
      return true;
    }
    // If transaction is aborted, we need to rollback and continue
    if (error.code === '25P02') {
      logSkip(`⚠️  Transaction was aborted, rolling back and continuing...`);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      return true;
    }
    throw error;
  }
}

async function applyInitialMigration(client) {
  console.log('\n📦 Applying initial database migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0000_overrated_khan.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  const parts = migrationSQL.split('--> statement-breakpoint');
  const statements = parts
    .map(part => part.trim())
    .filter(part => part.length > 0 && part.startsWith('CREATE TABLE'))
    .map(statement => {
      statement = statement.replace(/--.*$/gm, '').trim();
      return statement.endsWith(';') ? statement : statement + ';';
    })
    .filter(statement => statement.length > 1);

  // Use savepoints to handle errors without aborting the entire transaction
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Initial migration statement ${i + 1}/${statements.length}`;
      const match = statement.match(/CREATE TABLE "?(\w+)"?/i);
      if (match) {
        description = `Create table ${match[1]}`;
      }
      
      // Use savepoint for each statement
      const savepointName = `sp_init_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        // Check if it's an "already exists" error
        if (
          error.code === '42P07' || // relation already exists
          error.code === '23505' || // unique constraint violation
          error.code === '42710' || // duplicate object
          error.message.includes('already exists') ||
          error.message.includes('duplicate key')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applyRolesPermissionsMigration(client) {
  console.log('\n📦 Applying roles and permissions migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0001_add_roles_permissions.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  const parts = migrationSQL.split('--> statement-breakpoint');
  const statements = parts
    .map(part => part.trim())
    .filter(part => part.length > 0 && !part.startsWith('--'))
    .map(statement => {
      statement = statement.replace(/--.*$/gm, '').trim();
      return statement.endsWith(';') ? statement : statement + ';';
    })
    .filter(statement => statement.length > 1);

  // Use savepoints to handle errors without aborting the entire transaction
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Migration statement ${i + 1}/${statements.length}`;
      if (statement.includes('CREATE TABLE')) {
        const match = statement.match(/CREATE TABLE "?(\w+)"?/i);
        description = `Create table ${match ? match[1] : 'unknown'}`;
      } else if (statement.includes('ALTER TABLE')) {
        const match = statement.match(/ALTER TABLE "?(\w+)"?/i);
        description = `Alter table ${match ? match[1] : 'unknown'}`;
      } else if (statement.includes('ADD CONSTRAINT')) {
        const match = statement.match(/ALTER TABLE "?(\w+)"?/i);
        description = `Add constraint to ${match ? match[1] : 'unknown'}`;
      }
      
      // Use savepoint for each statement
      const savepointName = `sp_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        // Check if it's an "already exists" error
        if (
          error.code === '42P07' || // relation already exists
          error.code === '23505' || // unique constraint violation
          error.code === '42710' || // duplicate object
          error.code === '42723' || // function already exists
          error.message.includes('already exists') ||
          error.message.includes('duplicate key') ||
          error.message.includes('duplicate')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applyMetadataFieldsMigration(client) {
  console.log('\n📦 Applying metadata fields migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0002_add_metadata_fields.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  const parts = migrationSQL.split('--> statement-breakpoint');
  const statements = parts
    .map(part => part.trim())
    .filter(part => part.length > 0 && !part.startsWith('--'))
    .map(statement => {
      statement = statement.replace(/--.*$/gm, '').trim();
      return statement.endsWith(';') ? statement : statement + ';';
    })
    .filter(statement => statement.length > 1);

  // Use savepoints to handle errors without aborting the entire transaction
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Migration statement ${i + 1}/${statements.length}`;
      if (statement.includes('ALTER TABLE')) {
        const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
        if (match) {
          description = `Add column ${match[1]} to settings`;
        } else {
          description = `Alter table settings`;
        }
      }
      
      // Use savepoint for each statement
      const savepointName = `sp_meta_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        // Check if it's an "already exists" error
        if (
          error.code === '42P07' || // relation already exists
          error.code === '42701' || // duplicate column
          error.message.includes('already exists') ||
          error.message.includes('duplicate column') ||
          error.message.includes('duplicate')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applyAuditLogsMigration(client) {
  console.log('\n📦 Applying audit logs migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0003_add_audit_logs.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        let description = `Migration statement ${i + 1}/${statements.length}`;
        if (statement.includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE.*"(\w+)"/i);
          if (match) {
            description = `Create table ${match[1]}`;
          } else {
            description = `Create audit logs table`;
          }
        } else if (statement.includes('CREATE INDEX')) {
          const match = statement.match(/CREATE INDEX.*ON "(\w+)"/i);
          if (match) {
            description = `Create index on ${match[1]}`;
          } else {
            description = `Create index`;
          }
        }
        
        const savepointName = `sp_audit_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ ${description}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (
            error.code === '42P07' || // relation already exists
            error.code === '42701' || // duplicate column
            error.code === '42P16' || // index already exists
            error.message.includes('already exists') ||
            error.message.includes('duplicate column') ||
            error.message.includes('duplicate')
          ) {
            logSkip(`⚠️  ${description} - already exists, skipping`);
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found, skipping audit logs migration`);
    } else {
      throw error;
    }
  }
}

async function applyItemDiscountsMigration(client) {
  console.log('\n📦 Applying item discounts migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0004_add_item_discounts.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        let description = `Migration statement ${i + 1}/${statements.length}`;
        if (statement.includes('ALTER TABLE')) {
          const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
          if (match) {
            description = `Add column ${match[1]} to order_items`;
          } else {
            description = `Alter table order_items`;
          }
        }
        
        const savepointName = `sp_item_discount_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ ${description}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (
            error.code === '42P07' || // relation already exists
            error.code === '42701' || // duplicate column
            error.message.includes('already exists') ||
            error.message.includes('duplicate column') ||
            error.message.includes('duplicate') ||
            error.message.includes('column') && error.message.includes('already exists')
          ) {
            logSkip(`⚠️  ${description} - already exists, skipping`);
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found, skipping item discounts migration`);
    } else {
      throw error;
    }
  }
}

async function applyBarcodeMigration(client) {
  console.log('\n📦 Applying barcode migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0005_add_barcode_to_products.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        let description = `Migration statement ${i + 1}/${statements.length}`;
        if (statement.includes('ALTER TABLE')) {
          const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
          if (match) {
            description = `Add column ${match[1]} to products`;
          } else {
            description = `Alter table products`;
          }
        } else if (statement.includes('UPDATE')) {
          description = `Update existing products with barcodes`;
        }
        
        const savepointName = `sp_barcode_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ ${description}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (
            error.code === '42P07' || // relation already exists
            error.code === '42701' || // duplicate column
            error.message.includes('already exists') ||
            error.message.includes('duplicate column') ||
            error.message.includes('duplicate')
          ) {
            logSkip(`⚠️  ${description} - already exists, skipping`);
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found, skipping barcode migration`);
    } else {
      throw error;
    }
  }
}

async function applyScannerConfigMigration(client) {
  console.log('\n📦 Applying scanner configuration migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0006_add_scanner_config.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        let description = `Migration statement ${i + 1}/${statements.length}`;
        if (statement.includes('ALTER TABLE')) {
          const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
          if (match) {
            description = `Add column ${match[1]} to settings`;
          } else {
            description = `Alter table settings`;
          }
        }
        
        const savepointName = `sp_scanner_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ ${description}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (
            error.code === '42P07' || // relation already exists
            error.code === '42701' || // duplicate column
            error.message.includes('already exists') ||
            error.message.includes('duplicate column') ||
            error.message.includes('duplicate')
          ) {
            logSkip(`⚠️  ${description} - already exists, skipping`);
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found, skipping scanner config migration`);
    } else {
      throw error;
    }
  }
}

async function applyPurchasePiecesMigration(client) {
  console.log('\n📦 Applying purchase pieces migration...');
  
  const statements = [
    `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "pieces_per_unit" numeric(10, 2);`,
    `ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "price_per_piece" numeric(10, 2);`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Migration statement ${i + 1}/${statements.length}`;
      if (statement.includes('ALTER TABLE')) {
        const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
        if (match) {
          description = `Add column ${match[1]} to purchases`;
        } else {
          description = `Alter table purchases`;
        }
      }
      
      const savepointName = `sp_purchase_pieces_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        if (
          error.code === '42P07' || // relation already exists
          error.code === '42701' || // duplicate column
          error.message.includes('already exists') ||
          error.message.includes('duplicate column') ||
          error.message.includes('duplicate') ||
          error.message.includes('column') && error.message.includes('already exists')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applyInventoryRecordMigration(client) {
  console.log('\n📦 Applying stock short migration...');
  
  const statements = [
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_short" numeric(10, 2);`,
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock_short_reason" text;`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Migration statement ${i + 1}/${statements.length}`;
      if (statement.includes('ALTER TABLE')) {
        const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
        if (match) {
          description = `Add column ${match[1]} to products`;
        } else {
          description = `Alter table products`;
        }
      }
      
      const savepointName = `sp_inventory_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        if (
          error.code === '42701' || // duplicate column
          error.message.includes('already exists') ||
          error.message.includes('duplicate column')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applyMainStockCountMigration(client) {
  console.log('\n📦 Applying main stock count migration...');
  
  const statements = [
    `ALTER TABLE "main_products" ADD COLUMN IF NOT EXISTS "main_stock_count" numeric(10, 2) DEFAULT '0';`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Migration statement ${i + 1}/${statements.length}`;
      if (statement.includes('ALTER TABLE')) {
        const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
        if (match) {
          description = `Add column ${match[1]} to main_products`;
        } else {
          description = `Alter table main_products`;
        }
      }
      
      const savepointName = `sp_main_stock_count_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        if (
          error.code === '42701' || // duplicate column
          error.message.includes('already exists') ||
          error.message.includes('duplicate column')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applySizePurchasePricesMigration(client) {
  console.log('\n📦 Applying size purchase prices migration...');
  const statements = [
    `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_purchase_prices" jsonb;`,
  ];
  for (let i = 0; i < statements.length; i++) {
    try {
      await client.query(statements[i]);
      console.log(`✅ Add column size_purchase_prices to products`);
    } catch (error) {
      if (error.code === '42701' || error.message?.includes('already exists')) {
        logSkip(`⚠️  Column size_purchase_prices already exists, skipping`);
      } else throw error;
    }
  }
}

async function applyDuePaymentSlipsMigration(client) {
  console.log('\n📦 Applying due payment slips migration...');
  const statements = [
    `ALTER TABLE "due_payments" ADD COLUMN IF NOT EXISTS "payment_slips" text;`,
  ];
  for (let i = 0; i < statements.length; i++) {
    try {
      await client.query(statements[i]);
      console.log('✅ Add column payment_slips to due_payments');
    } catch (error) {
      if (error.code === '42701' || error.message?.includes('already exists')) {
        logSkip('⚠️  Column payment_slips already exists, skipping');
      } else throw error;
    }
  }
}

async function applyOrderCustomerContactTypeMigration(client) {
  console.log('\n📦 Applying order customer_contact_type migration...');
  try {
    await client.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_contact_type" text;`);
    console.log('✅ Add column customer_contact_type to orders');
  } catch (error) {
    if (error.code === '42701' || error.message?.includes('already exists')) {
      logSkip('⚠️  Column customer_contact_type already exists, skipping');
    } else throw error;
  }
}

async function applyPositionsDepartmentsMigration(client) {
  console.log('\n📦 Applying positions and departments migration...');
  const migrationPath = join(__dirname, '..', 'migrations', '0011_add_positions_departments.sql');
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        const savepointName = `sp_positions_depts_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ Positions/departments migration statement ${i + 1}/${statements.length}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (error.code === '42P07' || error.code === '42710' || error.message?.includes('already exists')) {
            logSkip(`⚠️  Statement ${i + 1} - already exists, skipping`);
          } else throw error;
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found: ${migrationPath}, skipping`);
    } else throw error;
  }
}

async function applyThemeCustomizationMigration(client) {
  console.log('\n📦 Applying theme customization migration...');
  const statements = [
    'ALTER TABLE settings ADD COLUMN IF NOT EXISTS "primary_color" text',
    `ALTER TABLE settings ADD COLUMN IF NOT EXISTS "component_size" text NOT NULL DEFAULT 'medium'`,
  ];
  for (let i = 0; i < statements.length; i++) {
    try {
      await client.query(statements[i]);
      const desc = statements[i].includes('primary_color') ? 'Add column primary_color to settings' : 'Add column component_size to settings';
      console.log(`✅ ${desc}`);
    } catch (error) {
      if (error.code === '42701' || error.message?.includes('already exists')) {
        logSkip(`⚠️  Column already exists, skipping`);
      } else throw error;
    }
  }
}

async function applySizePricingMigration(client) {
  console.log('\n📦 Applying size pricing migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0009_add_size_pricing.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        let description = `Migration statement ${i + 1}/${statements.length}`;
        if (statement.includes('ALTER TABLE')) {
          const match = statement.match(/ADD COLUMN.*"(\w+)"/i);
          if (match) {
            const tableMatch = statement.match(/ALTER TABLE "(\w+)"/i);
            const tableName = tableMatch ? tableMatch[1] : 'unknown';
            description = `Add column ${match[1]} to ${tableName}`;
          } else {
            description = `Alter table`;
          }
        }
        
        const savepointName = `sp_size_pricing_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ ${description}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (
            error.code === '42701' || // duplicate column
            error.message.includes('already exists') ||
            error.message.includes('duplicate column')
          ) {
            logSkip(`⚠️  ${description} - already exists, skipping`);
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found: ${migrationPath}, skipping`);
    } else {
      throw error;
    }
  }
}

async function applyUnitsMigration(client) {
  console.log('\n📦 Applying units migration...');
  
  const statements = [
    `CREATE TABLE IF NOT EXISTS "units" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" text NOT NULL UNIQUE,
      "description" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    );`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim() && statement !== ';') {
      let description = `Create table units`;
      
      const savepointName = `sp_units_${i}`;
      try {
        await client.query(`SAVEPOINT ${savepointName}`);
        await client.query(statement);
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
        console.log(`✅ ${description}`);
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        if (
          error.code === '42P07' || // relation already exists
          error.code === '42701' || // duplicate column
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        ) {
          logSkip(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function applyMainProductsMigration(client) {
  console.log('\n📦 Applying main products migration...');
  
  const migrationPath = join(__dirname, '..', 'migrations', '0007_add_main_products.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    const parts = migrationSQL.split('--> statement-breakpoint');
    const statements = parts
      .map(part => part.trim())
      .filter(part => part.length > 0 && !part.startsWith('--'))
      .map(statement => {
        statement = statement.replace(/--.*$/gm, '').trim();
        return statement.endsWith(';') ? statement : statement + ';';
      })
      .filter(statement => statement.length > 1);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && statement !== ';') {
        let description = `Migration statement ${i + 1}/${statements.length}`;
        if (statement.includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE.*"(\w+)"/i);
          if (match) {
            description = `Create table ${match[1]}`;
          } else {
            description = `Create main products table`;
          }
        } else if (statement.includes('ALTER TABLE')) {
          const match = statement.match(/ADD CONSTRAINT.*"(\w+)"/i);
          if (match) {
            description = `Add foreign key constraint ${match[1]}`;
          } else {
            description = `Alter table for main products`;
          }
        }
        
        const savepointName = `sp_main_products_${i}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          await client.query(statement);
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          console.log(`✅ ${description}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          if (
            error.code === '42P07' || // relation already exists
            error.code === '42701' || // duplicate column
            error.code === '23505' || // unique constraint violation
            error.code === '42710' || // duplicate object
            error.message.includes('already exists') ||
            error.message.includes('duplicate') ||
            error.message.includes('duplicate key')
          ) {
            logSkip(`⚠️  ${description} - already exists, skipping`);
          } else {
            throw error;
          }
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⚠️  Migration file not found: ${migrationPath}, skipping`);
    } else {
      throw error;
    }
  }
}

async function seedPermissions(client) {
  console.log('\n🌱 Seeding permissions...');
  
  const permissions = [
    // Sales permissions
    { name: 'sales.view', description: 'View sales and orders', category: 'sales' },
    { name: 'sales.create', description: 'Create new sales/orders', category: 'sales' },
    { name: 'sales.edit', description: 'Edit existing sales/orders', category: 'sales' },
    { name: 'sales.delete', description: 'Delete sales/orders', category: 'sales' },
    { name: 'sales.print', description: 'Print receipts', category: 'sales' },
    
    // Inventory permissions
    { name: 'inventory.view', description: 'View inventory items', category: 'inventory' },
    { name: 'inventory.create', description: 'Create inventory items', category: 'inventory' },
    { name: 'inventory.edit', description: 'Edit inventory items', category: 'inventory' },
    { name: 'inventory.delete', description: 'Delete inventory items', category: 'inventory' },
    { name: 'inventory.adjust', description: 'Adjust inventory quantities', category: 'inventory' },
    
    // Purchases permissions
    { name: 'purchases.view', description: 'View purchases', category: 'purchases' },
    { name: 'purchases.create', description: 'Create purchases', category: 'purchases' },
    { name: 'purchases.edit', description: 'Edit purchases', category: 'purchases' },
    { name: 'purchases.delete', description: 'Delete purchases', category: 'purchases' },
    
    // Expenses permissions
    { name: 'expenses.view', description: 'View expenses', category: 'expenses' },
    { name: 'expenses.create', description: 'Create expenses', category: 'expenses' },
    { name: 'expenses.edit', description: 'Edit expenses', category: 'expenses' },
    { name: 'expenses.delete', description: 'Delete expenses', category: 'expenses' },
    
    // Reports permissions
    { name: 'reports.view', description: 'View reports', category: 'reports' },
    { name: 'reports.export', description: 'Export reports', category: 'reports' },
    
    // Settings permissions
    { name: 'settings.view', description: 'View settings', category: 'settings' },
    { name: 'settings.edit', description: 'Edit settings', category: 'settings' },
    { name: 'settings.users', description: 'Manage users', category: 'settings' },
    { name: 'settings.roles', description: 'Manage roles', category: 'settings' },
    { name: 'settings.permissions', description: 'Manage permissions', category: 'settings' },
    
    // HRM permissions
    { name: 'hrm.view', description: 'View HRM data', category: 'hrm' },
    { name: 'hrm.create', description: 'Create HRM records', category: 'hrm' },
    { name: 'hrm.edit', description: 'Edit HRM records', category: 'hrm' },
    { name: 'hrm.delete', description: 'Delete HRM records', category: 'hrm' },
    
    // Branches permissions
    { name: 'branches.view', description: 'View branches', category: 'branches' },
    { name: 'branches.create', description: 'Create branches', category: 'branches' },
    { name: 'branches.edit', description: 'Edit branches', category: 'branches' },
    { name: 'branches.delete', description: 'Delete branches', category: 'branches' },
    
    // Bank Statement permissions
    { name: 'bank.view', description: 'View bank statements', category: 'bank' },
    { name: 'bank.create', description: 'Create bank transactions', category: 'bank' },
    { name: 'bank.edit', description: 'Edit bank transactions', category: 'bank' },
    { name: 'bank.delete', description: 'Delete bank transactions', category: 'bank' },
    
    // Due Management permissions
    { name: 'due.view', description: 'View due payments', category: 'due' },
    { name: 'due.create', description: 'Create due payments', category: 'due' },
    { name: 'due.edit', description: 'Edit due payments', category: 'due' },
    { name: 'due.delete', description: 'Delete due payments', category: 'due' },
  ];

  for (const permission of permissions) {
    try {
      const result = await client.query(
        'SELECT id FROM permissions WHERE name = $1',
        [permission.name]
      );
      
      if (result.rows.length === 0) {
        await client.query(
          'INSERT INTO permissions (name, description, category) VALUES ($1, $2, $3)',
          [permission.name, permission.description, permission.category]
        );
        console.log(`✅ Created permission: ${permission.name}`);
      } else {
        logSkip(`⚠️  Permission already exists: ${permission.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating permission ${permission.name}:`, error.message);
    }
  }
}

async function updateUnitsToLowercase(client) {
  console.log('\n🔄 Updating existing units to lowercase...');
  
  try {
    // First, check if units table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'units'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      logSkip('⚠️  Units table does not exist yet, skipping lowercase update');
      return;
    }
    
    // Get all units with their current names
    const unitsResult = await client.query('SELECT id, name FROM units');
    
    if (unitsResult.rows.length === 0) {
      logSkip('⚠️  No units found to update');
      return;
    }
    
    let updatedCount = 0;
    let duplicateCount = 0;
    
    // Process each unit
    for (const row of unitsResult.rows) {
      const currentName = row.name;
      const lowerName = currentName.toLowerCase();
      
      // Skip if already lowercase
      if (currentName === lowerName) {
        continue;
      }
      
      try {
        // Check if lowercase version already exists
        const existingCheck = await client.query(
          'SELECT id FROM units WHERE LOWER(name) = $1 AND id != $2',
          [lowerName, row.id]
        );
        
        if (existingCheck.rows.length > 0) {
          // Duplicate exists, delete the uppercase version
          await client.query('DELETE FROM units WHERE id = $1', [row.id]);
          logSkip(`⚠️  Removed duplicate unit "${currentName}" (lowercase version "${lowerName}" already exists)`);
          duplicateCount++;
        } else {
          // Update to lowercase
          await client.query(
            'UPDATE units SET name = $1 WHERE id = $2',
            [lowerName, row.id]
          );
          console.log(`✅ Updated unit "${currentName}" → "${lowerName}"`);
          updatedCount++;
        }
      } catch (error) {
        // If there's a unique constraint violation, it means the lowercase version exists
        if (error.code === '23505') {
          await client.query('DELETE FROM units WHERE id = $1', [row.id]);
          logSkip(`⚠️  Removed duplicate unit "${currentName}" (lowercase version "${lowerName}" already exists)`);
          duplicateCount++;
        } else {
          console.error(`❌ Error updating unit "${currentName}":`, error.message);
        }
      }
    }
    
    if (updatedCount > 0 || duplicateCount > 0) {
      console.log(`✅ Updated ${updatedCount} units to lowercase, removed ${duplicateCount} duplicates`);
    } else {
      console.log('✅ All units are already lowercase');
    }
  } catch (error) {
    console.error('❌ Error updating units to lowercase:', error.message);
    // Don't throw - allow migration to continue
  }
}

async function seedUnits(client) {
  console.log('\n🌱 Seeding default units...');
  
  const defaultUnits = [
    { name: 'kg', description: 'Kilogram' },
    { name: 'g', description: 'Gram' },
    { name: 'l', description: 'Litre' },
    { name: 'ml', description: 'Millilitre' },
    { name: 'piece', description: 'Piece' },
    { name: 'pack', description: 'Pack' },
    { name: 'box', description: 'Box' },
    { name: 'dozen', description: 'Dozen' },
    { name: 'unit', description: 'Unit' },
    { name: 'meter', description: 'Meter' },
    { name: 'cm', description: 'Centimeter' },
    { name: 'ft', description: 'Feet' },
    { name: 'inch', description: 'Inch' },
  ];

  for (const unit of defaultUnits) {
    try {
      const result = await client.query(
        'SELECT id FROM units WHERE name = $1',
        [unit.name]
      );
      
      if (result.rows.length === 0) {
        await client.query(
          'INSERT INTO units (name, description) VALUES ($1, $2)',
          [unit.name, unit.description]
        );
        console.log(`✅ Created unit: ${unit.name}`);
      } else {
        logSkip(`⚠️  Unit already exists: ${unit.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating unit ${unit.name}:`, error.message);
    }
  }
}

async function createAdminUser(client) {
  console.log('\n👤 Creating admin user...');
  
  // Detect which POS instance this is based on PORT or DATABASE_URL
  const port = parseInt(process.env.PORT || '0');
  const databaseUrl = process.env.DATABASE_URL || '';
  
  let adminUsername, adminPassword, adminEmail, adminFullName;
  
  // Determine instance-specific admin credentials
  if (port === 7000 || port === 7050 || databaseUrl.includes('bfcpos_db')) {
    // BFC POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@bfcpos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@bfcpos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'BFC Administrator';
    console.log('📍 Detected BFC POS instance');
  } else if (port === 8000 || databaseUrl.includes('bondcoffeepos_db')) {
    // Bond Coffee POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@bondcoffeepos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@bondcoffeepos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Bond Coffee Administrator';
    console.log('📍 Detected Bond Coffee POS instance');
  } else if (port === 7060 || databaseUrl.includes('adorapos_db')) {
    // Adora POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@adorapos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@adorapos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Adora Administrator';
    console.log('📍 Detected Adora POS instance');
  } else if (port === 7070 || databaseUrl.includes('seapos_db')) {
    // Sea POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@seapos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@seapos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Sea Administrator';
    console.log('📍 Detected Sea POS instance');
  } else if (databaseUrl.includes('coffeehouse_db')) {
    // Coffeehouse POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@coffeehousepos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@coffeehousepos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Coffeehouse Administrator';
    console.log('📍 Detected Coffeehouse POS instance');
  } else if (databaseUrl.includes('barpos_db') || port === 7100) {
    // Bar POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@barpos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@barpos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Bar Administrator';
    console.log('📍 Detected Bar POS instance');
  } else if (port === 7080 || databaseUrl.includes('primeclinicpos_db')) {
    // Prime Clinic POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@primeclinicpos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@primeclinicpos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Prime Clinic Administrator';
    console.log('📍 Detected Prime Clinic POS instance');
  } else {
    // Fallback to environment variables or defaults
    adminUsername = process.env.ADMIN_USERNAME || 'admin';
    adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    adminEmail = process.env.ADMIN_EMAIL || `${adminUsername}@pos.local`;
    adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';
    console.log('⚠️  Could not detect instance, using defaults or environment variables');
  }

  try {
    // Check if admin user already exists with the specific username for this instance
    const existingUser = await client.query(
      'SELECT id, role_id, username, email, full_name FROM users WHERE username = $1 OR email = $2',
      [adminUsername, adminEmail]
    );

    if (existingUser.rows.length > 0) {
      const existingUserData = existingUser.rows[0];
      
      // Check if the existing user has the correct credentials for this instance
      const needsUpdate = existingUserData.username !== adminUsername || 
                         existingUserData.email !== adminEmail;
      
      if (needsUpdate) {
        console.log(`⚠️  Admin user exists but with different credentials, updating...`);
        console.log(`   Old: username=${existingUserData.username}, email=${existingUserData.email || 'N/A'}`);
        console.log(`   New: username=${adminUsername}, email=${adminEmail}`);
        
        // Update the existing user with correct credentials
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await client.query(
          `UPDATE users SET username = $1, email = $2, password = $3, full_name = $4 
           WHERE id = $5`,
          [adminUsername, adminEmail, hashedPassword, adminFullName, existingUserData.id]
        );
        console.log(`✅ Updated admin user credentials`);
      } else {
        logSkip(`⚠️  Admin user '${existingUserData.username}' already exists with correct credentials, skipping user creation`);
        logSkip(`   Existing user details: username=${existingUserData.username}, email=${existingUserData.email || 'N/A'}`);
      }
      
      // Ensure admin role has all permissions
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['admin']
      );
      
      if (roleResult.rows.length > 0) {
        const adminRoleId = roleResult.rows[0].id;
        const allPermissions = await client.query('SELECT id FROM permissions');
        const permissionIds = allPermissions.rows.map(row => row.id);
        
        if (permissionIds.length > 0) {
          // Check existing permissions for admin role
          const existingPermissions = await client.query(
            'SELECT permission_id FROM role_permissions WHERE role_id = $1',
            [adminRoleId]
          );
          const existingPermissionIds = existingPermissions.rows.map(row => row.permission_id);
          
          // Only add missing permissions, don't remove existing ones
          const missingPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id));
          
          if (missingPermissionIds.length > 0) {
            const values = missingPermissionIds.map((_, index) => 
              `($1, $${index + 2})`
            ).join(', ');
            const query = `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`;
            await client.query(query, [adminRoleId, ...missingPermissionIds]);
            console.log(`✅ Added ${missingPermissionIds.length} missing permissions to admin role`);
          } else {
            console.log(`✅ Admin role already has all ${permissionIds.length} permissions`);
          }
        }
      }
      return;
    }

    // Check if admin role exists, create if not
    let adminRoleId = null;
    const roleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      ['admin']
    );

    if (roleResult.rows.length === 0) {
      const roleInsert = await client.query(
        'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
        ['admin', 'Full system access with all permissions']
      );
      adminRoleId = roleInsert.rows[0].id;
      console.log('✅ Created admin role');
    } else {
      adminRoleId = roleResult.rows[0].id;
      logSkip('⚠️  Admin role already exists');
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await client.query(
      `INSERT INTO users (username, password, full_name, email, role, role_id, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [adminUsername, hashedPassword, adminFullName, adminEmail, 'admin', adminRoleId, 'true']
    );
    console.log(`✅ Created admin user: ${adminUsername}`);

    // Assign all permissions to admin role
    if (adminRoleId) {
      const allPermissions = await client.query('SELECT id FROM permissions');
      const permissionIds = allPermissions.rows.map(row => row.id);
      
      // Clear existing permissions
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [adminRoleId]);
      
      // Insert all permissions
      if (permissionIds.length > 0) {
        const values = permissionIds.map((_, index) => 
          `($1, $${index + 2})`
        ).join(', ');
        const query = `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`;
        await client.query(query, [adminRoleId, ...permissionIds]);
        console.log(`✅ Assigned ${permissionIds.length} permissions to admin role`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  }
}

async function runAllMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration process...\n');
    console.log('📊 Connecting to database...');
    console.log('✅ Connected to database\n');

    // Start transaction
    await client.query('BEGIN');

    // 1. Apply initial database migration (uses savepoints internally)
    await applyInitialMigration(client);
    await client.query('COMMIT');

    // 2. Apply roles and permissions migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyRolesPermissionsMigration(client);
    await client.query('COMMIT');

    // 3. Apply metadata fields migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyMetadataFieldsMigration(client);
    await client.query('COMMIT');

    // 4. Apply audit logs migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyAuditLogsMigration(client);
    await client.query('COMMIT');

    // 5. Apply item discounts migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyItemDiscountsMigration(client);
    await client.query('COMMIT');

    // 6. Apply barcode migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyBarcodeMigration(client);
    await client.query('COMMIT');

    // 7. Apply scanner configuration migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyScannerConfigMigration(client);
    await client.query('COMMIT');

    // 8. Apply purchase pieces migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyPurchasePiecesMigration(client);
    await client.query('COMMIT');

    // 9. Apply inventory record and stock short migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyInventoryRecordMigration(client);
    await client.query('COMMIT');

    // 10. Apply main products migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyMainProductsMigration(client);
    await client.query('COMMIT');

    // 11. Apply main stock count migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyMainStockCountMigration(client);
    await client.query('COMMIT');

    // 12. Apply units migration (uses savepoints internally)
    await client.query('BEGIN');
    await applyUnitsMigration(client);
    await client.query('COMMIT');

    // 13. Update existing units to lowercase (run in separate transaction)
    await client.query('BEGIN');
    await updateUnitsToLowercase(client);
    await client.query('COMMIT');

    // 14. Seed default units (run in separate transaction)
    await client.query('BEGIN');
    await seedUnits(client);
    await client.query('COMMIT');

    // 15. Seed permissions (run in separate transaction)
    await client.query('BEGIN');
    await seedPermissions(client);
    await client.query('COMMIT');

    // 16. Apply size pricing migration (uses savepoints internally)
    await client.query('BEGIN');
    await applySizePricingMigration(client);
    await client.query('COMMIT');

    // 16a. Apply size purchase prices migration (products table)
    await client.query('BEGIN');
    await applySizePurchasePricesMigration(client);
    await client.query('COMMIT');

    // 16b. Apply theme customization migration
    await client.query('BEGIN');
    await applyThemeCustomizationMigration(client);
    await client.query('COMMIT');

    // 16c. Apply positions and departments migration
    await client.query('BEGIN');
    await applyPositionsDepartmentsMigration(client);
    await client.query('COMMIT');

    // 16d. Apply due payment slips migration
    await client.query('BEGIN');
    await applyDuePaymentSlipsMigration(client);
    await client.query('COMMIT');

    // 16e. Apply order customer_contact_type (web orders)
    await client.query('BEGIN');
    await applyOrderCustomerContactTypeMigration(client);
    await client.query('COMMIT');

    // 17. Create admin user (run in separate transaction)
    await client.query('BEGIN');
    await createAdminUser(client);
    await client.query('COMMIT');
    
    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Initial database tables created');
    console.log('  - Roles and permissions tables created');
    console.log('  - Metadata fields added to settings');
    console.log('  - Audit logs table created');
    console.log('  - Item discount fields added to order_items');
    console.log('  - Barcode field added to products');
    console.log('  - Scanner configuration fields added to settings');
    console.log('  - Purchase pieces fields added to purchases');
    console.log('  - Stock short and stock short reason fields added to products');
    console.log('  - Main products tables created');
    console.log('  - Units table created');
    console.log('  - Default units seeded');
    console.log('  - Permissions seeded');
    console.log('  - Size pricing fields added to products and order_items');
    console.log('  - Size purchase prices field added to products');
    console.log('  - Due payment slips field added to due_payments');
    console.log('  - Admin user created');
    console.log('\n🎉 Migration process finished!');
    
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    console.error('\n❌ Migration failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runAllMigrations().catch(console.error);

