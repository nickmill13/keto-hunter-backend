const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log('Adding new columns to restaurant_signals table...');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS customization_mentions INT DEFAULT 0`);
    console.log('✅ Added customization_mentions');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS keto_food_mentions INT DEFAULT 0`);
    console.log('✅ Added keto_food_mentions');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS healthy_cooking_mentions INT DEFAULT 0`);
    console.log('✅ Added healthy_cooking_mentions');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS dietary_mentions INT DEFAULT 0`);
    console.log('✅ Added dietary_mentions');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS portion_mentions INT DEFAULT 0`);
    console.log('✅ Added portion_mentions');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS hidden_carb_mentions INT DEFAULT 0`);
    console.log('✅ Added hidden_carb_mentions');
    
    await pool.query(`ALTER TABLE restaurant_signals ADD COLUMN IF NOT EXISTS high_carb_mentions INT DEFAULT 0`);
    console.log('✅ Added high_carb_mentions');
    
    console.log('\n🎉 Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();