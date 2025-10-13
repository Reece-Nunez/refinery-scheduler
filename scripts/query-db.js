// Quick database query script
// Usage: node scripts/query-db.js "SELECT * FROM table"

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function query(sql) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query_text: sql })

    if (error) {
      // If RPC doesn't exist, fall back to direct table query
      console.error('RPC not available. Please provide table name and filters.')
      process.exit(1)
    }

    console.log(JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Query error:', err.message)
    process.exit(1)
  }
}

const sql = process.argv[2]
if (!sql) {
  console.error('Usage: node scripts/query-db.js "SELECT * FROM table"')
  process.exit(1)
}

query(sql)
