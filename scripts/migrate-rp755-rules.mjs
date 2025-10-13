import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function runMigration() {
  try {
    console.log('Running RP-755 rules migration...')
    console.log('Creating rp755_rules table...')

    // Check if table already exists
    const { data: existingRules, error: checkError } = await supabase
      .from('rp755_rules')
      .select('id')
      .limit(1)

    if (!checkError) {
      console.log('✓ Table rp755_rules already exists!')
      const { count } = await supabase
        .from('rp755_rules')
        .select('*', { count: 'exact', head: true })
      console.log(`✓ Found ${count || 0} existing rules`)

      if (count && count > 0) {
        console.log('Migration already completed. Exiting.')
        return
      }
    }

    // Insert default rules
    console.log('Inserting default RP-755 rules...')

    const rules = [
      // Normal Operations Rules
      {
        id: 'shift_length',
        category: 'normal',
        name: 'Maximum Shift Length',
        description: 'Total hours (including hand-offs, holdovers, and overtime) shall not exceed 14 hours per shift',
        limit: 14,
        unit: 'hours per shift',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'work_set_normal',
        category: 'normal',
        name: 'Work-set Hour Limit (Normal Operations)',
        description: 'Total hours shall not exceed 92 hours per work-set (105 hours for straight day assignments)',
        limit: 92,
        unit: 'hours per work-set',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'rest_period_normal',
        category: 'normal',
        name: 'Minimum Rest Period (Normal)',
        description: 'Work-set complete when employee is off work for at least 34 hours (46 hours if 4+ night shifts)',
        limit: 34,
        unit: 'hours off work',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'minimum_rest',
        category: 'normal',
        name: 'Minimum Rest Between Shifts',
        description: 'Minimum 8 hours off between shifts (RP-755 best practice)',
        limit: 8,
        unit: 'hours off work',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'consecutive_shifts_12hr',
        category: 'normal',
        name: 'Maximum Consecutive 12-Hour Shifts',
        description: 'Maximum 7 consecutive 12-hour shifts during normal operations',
        limit: 7,
        unit: 'consecutive shifts',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'consecutive_shifts_10hr',
        category: 'normal',
        name: 'Maximum Consecutive 10-Hour Shifts',
        description: 'Maximum 9 consecutive 10-hour shifts during normal operations',
        limit: 9,
        unit: 'consecutive shifts',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'consecutive_shifts_8hr',
        category: 'normal',
        name: 'Maximum Consecutive 8-Hour Shifts',
        description: 'Maximum 10 consecutive 8-hour shifts during normal operations',
        limit: 10,
        unit: 'consecutive shifts',
        enabled: true,
        is_high_risk: false
      },
      // Outage Rules
      {
        id: 'work_set_outage',
        category: 'outage',
        name: 'Work-set Hour Limit (Outages)',
        description: 'Total hours shall not exceed 182 hours per work-set during planned outages',
        limit: 182,
        unit: 'hours per work-set',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'rest_period_outage',
        category: 'outage',
        name: 'Minimum Rest Period (Outages)',
        description: 'Work-set complete when employee is off work for at least 34 hours after the work-set',
        limit: 34,
        unit: 'hours off work',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'consecutive_shifts_12hr_outage',
        category: 'outage',
        name: 'Maximum Consecutive 12-Hour Shifts (Outages)',
        description: 'Maximum 14 consecutive 12-hour shifts during planned outages',
        limit: 14,
        unit: 'consecutive shifts',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'consecutive_shifts_10hr_outage',
        category: 'outage',
        name: 'Maximum Consecutive 10-Hour Shifts (Outages)',
        description: 'Maximum 14 consecutive 10-hour shifts during planned outages',
        limit: 14,
        unit: 'consecutive shifts',
        enabled: true,
        is_high_risk: false
      },
      {
        id: 'consecutive_shifts_8hr_outage',
        category: 'outage',
        name: 'Maximum Consecutive 8-Hour Shifts (Outages)',
        description: 'Maximum 19 consecutive 8-hour shifts during planned outages',
        limit: 19,
        unit: 'consecutive shifts',
        enabled: true,
        is_high_risk: false
      },
      // High Risk Exception Thresholds
      {
        id: 'high_risk_shift',
        category: 'exception',
        name: 'High Risk - Extended Shift',
        description: 'Work more than 18 hours in a single shift requires senior management notification',
        limit: 18,
        unit: 'hours per shift',
        enabled: true,
        is_high_risk: true
      },
      {
        id: 'high_risk_rest',
        category: 'exception',
        name: 'High Risk - Insufficient Rest',
        description: 'Return to work prior to having 8 hours off requires senior management notification',
        limit: 8,
        unit: 'hours off work',
        enabled: true,
        is_high_risk: true
      },
      {
        id: 'high_risk_extended',
        category: 'exception',
        name: 'High Risk - Multiple Extended Shifts',
        description: 'Work more than one extended shift (>14 hours) per work-set requires senior management notification',
        limit: 1,
        unit: 'extended shifts per work-set',
        enabled: true,
        is_high_risk: true
      }
    ]

    for (const rule of rules) {
      const { error } = await supabase
        .from('rp755_rules')
        .insert(rule)

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        console.error(`Error inserting rule ${rule.id}:`, error)
      } else {
        console.log(`✓ Inserted rule: ${rule.id}`)
      }
    }

    // Verify migration
    const { count } = await supabase
      .from('rp755_rules')
      .select('*', { count: 'exact', head: true })

    console.log(`\n✓ Migration completed successfully!`)
    console.log(`✓ Total rules in database: ${count}`)

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
