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

function formatPhoneNumber(value) {
  if (!value) return null
  // Remove all non-numeric characters
  const cleaned = value.replace(/\D/g, '')
  // Format as XXX-XXX-XXXX
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
}

async function formatAllPhoneNumbers() {
  console.log('🔄 Fetching all operators...')

  // Get all operators with phone numbers
  const { data: operators, error: fetchError } = await supabase
    .from('operators')
    .select('id, name, phone')
    .not('phone', 'is', null)

  if (fetchError) {
    console.error('❌ Error fetching operators:', fetchError.message)
    return
  }

  if (!operators || operators.length === 0) {
    console.log('ℹ️ No operators with phone numbers found')
    return
  }

  console.log(`📞 Found ${operators.length} operators with phone numbers`)
  console.log('🔄 Formatting phone numbers...')

  let updated = 0
  let skipped = 0

  for (const operator of operators) {
    const formatted = formatPhoneNumber(operator.phone)

    // Only update if the format changed
    if (formatted !== operator.phone) {
      const { error: updateError } = await supabase
        .from('operators')
        .update({ phone: formatted })
        .eq('id', operator.id)

      if (updateError) {
        console.error(`❌ Error updating ${operator.name}:`, updateError.message)
      } else {
        console.log(`✅ ${operator.name}: ${operator.phone} → ${formatted}`)
        updated++
      }
    } else {
      console.log(`⏭️  ${operator.name}: Already formatted (${operator.phone})`)
      skipped++
    }
  }

  console.log('\n✨ Done!')
  console.log(`📊 Summary: ${updated} updated, ${skipped} already formatted`)
}

formatAllPhoneNumbers()
  .catch(err => {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  })
