import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function seedJobs() {
  const jobs = [
    {
      title: 'FCC Console',
      description: 'Fluid Catalytic Cracking Console Operator'
    },
    {
      title: 'VRU Console',
      description: 'Vacuum Residue Unit Console Operator'
    },
    {
      title: 'FCC Out',
      description: 'FCC Outside Operator'
    },
    {
      title: 'VRU Out',
      description: 'VRU Outside Operator'
    },
    {
      title: 'Butamer',
      description: 'Butamer Unit Operator'
    },
    {
      title: 'Pumper',
      description: 'Pumper/Gauger'
    }
  ]

  try {
    // Check if jobs already exist
    const { data: existingJobs } = await supabase
      .from('jobs')
      .select('title')

    const existingTitles = existingJobs?.map(j => j.title) || []

    // Filter out jobs that already exist
    const newJobs = jobs.filter(job => !existingTitles.includes(job.title))

    if (newJobs.length === 0) {
      console.log('All jobs already exist in the database!')
      console.log('Existing jobs:', existingTitles)
      return
    }

    // Insert new jobs
    const { data, error } = await supabase
      .from('jobs')
      .insert(newJobs)
      .select()

    if (error) {
      console.error('Error seeding jobs:', error)
      return
    }

    console.log(`Successfully added ${newJobs.length} job(s):`)
    newJobs.forEach(job => console.log(`  - ${job.title}`))

    if (existingTitles.length > 0) {
      console.log(`\nSkipped ${existingTitles.length} existing job(s)`)
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

seedJobs()
