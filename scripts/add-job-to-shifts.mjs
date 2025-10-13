import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addJobIdColumnToShifts() {
  try {
    console.log('Adding jobId column to shifts table...')

    // Since we're using Supabase, we need to run raw SQL
    // This adds a jobId column that references the jobs table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE shifts
        ADD COLUMN IF NOT EXISTS "jobId" UUID REFERENCES jobs(id);
      `
    })

    if (error) {
      console.error('Error adding column:', error)
      console.log('\nPlease run this SQL manually in your Supabase SQL Editor:')
      console.log('----------------------------------------')
      console.log('ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "jobId" UUID REFERENCES jobs(id);')
      console.log('----------------------------------------')
      return
    }

    console.log('✅ Successfully added jobId column to shifts table!')

  } catch (error) {
    console.error('Error:', error)
    console.log('\nPlease run this SQL manually in your Supabase SQL Editor:')
    console.log('----------------------------------------')
    console.log('ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "jobId" UUID REFERENCES jobs(id);')
    console.log('----------------------------------------')
  }
}

addJobIdColumnToShifts()
