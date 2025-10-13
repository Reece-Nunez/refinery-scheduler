// Check team schedules
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkSchedule() {
  try {
    // Get all team schedules for Saturday
    const { data: schedules, error } = await supabase
      .from('team_schedules')
      .select('*')
      .eq('day_of_week', 'saturday')
      .order('team')
      .order('shift_type')

    if (error) throw error

    console.log('\nSaturday Team Schedules:')
    console.log('========================')
    schedules.forEach(s => {
      console.log(`${s.team} - ${s.shift_type}: ${s.is_working ? 'WORKING' : 'OFF'}`)
    })

    // Check if C team works day shift on Saturday
    const cTeamDay = schedules.find(s => s.team === 'C' && s.shift_type === 'day')
    console.log(`\nC Team Day Shift on Saturday: ${cTeamDay?.is_working ? 'YES' : 'NO'}`)

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

checkSchedule()
