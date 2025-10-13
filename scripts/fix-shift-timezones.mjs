import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixShiftTimezones() {
  console.log('🔄 Fetching all shifts...')

  // Get all shifts
  const { data: shifts, error: fetchError } = await supabase
    .from('shifts')
    .select('*')
    .order('startTime', { ascending: true })

  if (fetchError) {
    console.error('❌ Error fetching shifts:', fetchError.message)
    return
  }

  if (!shifts || shifts.length === 0) {
    console.log('ℹ️ No shifts found')
    return
  }

  console.log(`📅 Found ${shifts.length} shifts`)
  console.log('🔄 Fixing timezone issues...\n')

  let updated = 0
  let skipped = 0

  for (const shift of shifts) {
    try {
      const oldStart = new Date(shift.startTime)
      const oldEnd = new Date(shift.endTime)

      // The issue is that times are stored as UTC but they should be local time
      // For example: "2025-10-05 09:45:00+00" should actually be "2025-10-05 04:45:00" local
      // We need to extract the UTC date and create a local date with the correct times

      const year = oldStart.getUTCFullYear()
      const month = oldStart.getUTCMonth()
      const date = oldStart.getUTCDate()

      // Create new dates in local time with the same DATE but correct TIMES
      const newStart = new Date(year, month, date)
      const newEnd = new Date(year, month, date)

      // Set the correct times based on shift type
      if (shift.shiftType === 'day') {
        newStart.setHours(4, 45, 0, 0)
        newEnd.setHours(16, 45, 0, 0)
      } else if (shift.shiftType === 'night') {
        newStart.setHours(16, 45, 0, 0)
        newEnd.setDate(newEnd.getDate() + 1)
        newEnd.setHours(4, 45, 0, 0)
      } else {
        console.log(`⏭️  Shift ${shift.id}: Unknown shift type '${shift.shiftType}', skipping`)
        skipped++
        continue
      }

      // Always update since the times in DB are wrong (09:45 instead of 04:45)
      const { error: updateError } = await supabase
        .from('shifts')
        .update({
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString()
        })
        .eq('id', shift.id)

      if (updateError) {
        console.error(`❌ Error updating shift ${shift.id}:`, updateError.message)
      } else {
        console.log(`✅ Shift ${shift.id} (${shift.shiftType}):`)
        console.log(`   Old UTC: ${shift.startTime} - ${shift.endTime}`)
        console.log(`   Old Local: ${oldStart.toLocaleString()} - ${oldEnd.toLocaleString()}`)
        console.log(`   New Local: ${newStart.toLocaleString()} - ${newEnd.toLocaleString()}`)
        console.log(`   New UTC: ${newStart.toISOString()} - ${newEnd.toISOString()}`)
        updated++
      }
    } catch (err) {
      console.error(`❌ Error processing shift ${shift.id}:`, err.message)
    }
  }

  console.log('\n✨ Done!')
  console.log(`📊 Summary: ${updated} updated, ${skipped} skipped`)
}

fixShiftTimezones()
  .catch(err => {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  })
