// Check C team fatigue for Oct 11
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkCTeamFatigue() {
  try {
    // Get all C team operators
    const { data: operators, error: opError } = await supabase
      .from('operators')
      .select('id, name, team, role')
      .eq('team', 'C')
      .order('name')

    if (opError) throw opError

    console.log(`\nFound ${operators.length} C team operators\n`)

    // Check shifts for each operator around Oct 11
    for (const op of operators) {
      const { data: shifts, error: shiftError } = await supabase
        .from('shifts')
        .select('startTime, endTime, shiftType')
        .eq('operatorId', op.id)
        .gte('startTime', '2025-10-01')
        .lte('startTime', '2025-10-15')
        .order('startTime')

      if (shiftError) throw shiftError

      console.log(`${op.name} (${op.role || 'Operator'}):`)
      if (shifts.length === 0) {
        console.log('  No shifts Oct 1-15')
      } else {
        shifts.forEach(s => {
          const start = new Date(s.startTime)
          const end = new Date(s.endTime)
          const hours = (end - start) / (1000 * 60 * 60)
          console.log(`  ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${s.shiftType} shift (${hours}h)`)
        })

        // Check if they have consecutive shifts ending before Oct 11
        const beforeOct11 = shifts.filter(s => new Date(s.startTime) < new Date(2025, 9, 11))
        if (beforeOct11.length > 0) {
          const lastShift = beforeOct11[beforeOct11.length - 1]
          const lastEnd = new Date(lastShift.endTime)
          const oct11Start = new Date(2025, 9, 11, 9, 45) // Day shift starts 9:45 AM
          const restHours = (oct11Start - lastEnd) / (1000 * 60 * 60)
          console.log(`  → Last shift before Oct 11 ends: ${lastEnd.toLocaleString()}`)
          console.log(`  → Rest before Oct 11 day shift: ${restHours.toFixed(1)} hours`)
          console.log(`  → ${beforeOct11.length} consecutive shifts before Oct 11`)
        }
      }
      console.log('')
    }

  } catch (err) {
    console.error('Error:', err.message)
  }
}

checkCTeamFatigue()
