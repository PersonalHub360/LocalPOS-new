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
      console.log(`⚠️  ${description} - already exists, skipping`);
      return true;
    }
    // If transaction is aborted, we need to rollback and continue
    if (error.code === '25P02') {
      console.log(`⚠️  Transaction was aborted, rolling back and continuing...`);
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
          console.log(`⚠️  ${description} - already exists, skipping`);
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
          console.log(`⚠️  ${description} - already exists, skipping`);
        } else {
          throw error;
        }
      }
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
        console.log(`⚠️  Permission already exists: ${permission.name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating permission ${permission.name}:`, error.message);
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
  if (port === 7000 || databaseUrl.includes('bfcpos_db')) {
    // BFC POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@bfcpos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@bfcpos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'BFC Administrator';
    console.log('📍 Detected BFC POS instance');
  } else if (port === 8000 || databaseUrl.includes('adorapos_db')) {
    // Adora POS instance
    adminUsername = process.env.ADMIN_USERNAME || 'admin@adorapos.com';
    adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2024';
    adminEmail = process.env.ADMIN_EMAIL || 'admin@adorapos.com';
    adminFullName = process.env.ADMIN_FULL_NAME || 'Adora Administrator';
    console.log('📍 Detected Adora POS instance');
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
      'SELECT id, role_id, username FROM users WHERE username = $1',
      [adminUsername]
    );

    if (existingUser.rows.length > 0) {
      const existingUsername = existingUser.rows[0].username;
      console.log(`⚠️  Admin user '${existingUsername}' already exists, skipping user creation (will NOT modify existing user)`);
      
      // Still ensure admin role has all permissions
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        ['admin']
      );
      
      if (roleResult.rows.length > 0) {
        const adminRoleId = roleResult.rows[0].id;
        const allPermissions = await client.query('SELECT id FROM permissions');
        const permissionIds = allPermissions.rows.map(row => row.id);
        
        if (permissionIds.length > 0) {
          // Clear existing permissions
          await client.query('DELETE FROM role_permissions WHERE role_id = $1', [adminRoleId]);
          
          // Insert all permissions
          const values = permissionIds.map((_, index) => 
            `($1, $${index + 2})`
          ).join(', ');
          const query = `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`;
          await client.query(query, [adminRoleId, ...permissionIds]);
          console.log(`✅ Updated admin role with ${permissionIds.length} permissions`);
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
      console.log('⚠️  Admin role already exists');
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

    // 3. Seed permissions (run in separate transaction)
    await client.query('BEGIN');
    await seedPermissions(client);
    await client.query('COMMIT');

    // 4. Create admin user (run in separate transaction)
    await client.query('BEGIN');
    await createAdminUser(client);
    await client.query('COMMIT');
    
    console.log('\n✅ All migrations completed successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Initial database tables created');
    console.log('  - Roles and permissions tables created');
    console.log('  - Permissions seeded');
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

