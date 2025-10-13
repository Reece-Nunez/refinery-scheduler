// List all tables in the database
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listTables() {
  try {
    // Query pg_catalog to get table names
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name')

    if (error) {
      console.log('Cannot query information_schema, trying direct table list...')
      // Try common table names
      const tables = ['operators', 'shifts', 'jobs', 'vacation', 'mandate_protection', 'team_schedules', 'users']
      console.log('\nAttempting to check these tables:')
      for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
        if (!error) {
          console.log(`✓ ${table} (${count} rows)`)
        }
      }
      return
    }

    console.log('\nAll tables in public schema:')
    data.forEach(t => console.log(`  - ${t.table_name}`))

  } catch (err) {
    console.error('Error:', err.message)
  }
}

listTables()
