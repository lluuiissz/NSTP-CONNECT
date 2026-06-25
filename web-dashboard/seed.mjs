import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://alplydafnokiucslivsd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscGx5ZGFmbm9raXVjc2xpdnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTE4MTUsImV4cCI6MjA5NzgyNzgxNX0.0VhPfQ47aZFveyQ-QPRAuZZTWMZtyUkhTldDNxVRUHM'

const supabase = createClient(supabaseUrl, supabaseKey)

async function createAdmin() {
  console.log('Creating LGU Admin account...')
  const { data: adminAuth, error: adminErr } = await supabase.auth.signUp({
    email: 'admin@lgu.gov.ph',
    password: 'password123',
    options: {
      data: {
        full_name: 'Super Admin',
        role: 'admin'
      }
    }
  })

  if (adminErr) {
    console.error('Error creating admin:', adminErr.message)
  } else {
    console.log('Admin auth created. Wait a second for trigger to fire...')
    await new Promise(r => setTimeout(r, 1000))
    
    // Update role to admin
    await supabase.from('users').update({ role: 'admin' }).eq('id', adminAuth.user.id)
    console.log('LGU Admin ready! Login with admin@lgu.gov.ph / password123')
  }

  console.log('\nCreating NSTP Office account...')
  const { data: nstpAuth, error: nstpErr } = await supabase.auth.signUp({
    email: 'office@nstp.edu.ph',
    password: 'password123',
    options: {
      data: {
        full_name: 'NSTP Coordinator',
        role: 'nstp'
      }
    }
  })

  if (nstpErr) {
    console.error('Error creating NSTP user:', nstpErr.message)
  } else {
    await new Promise(r => setTimeout(r, 1000))
    await supabase.from('users').update({ role: 'nstp' }).eq('id', nstpAuth.user.id)
    console.log('NSTP Coordinator ready! Login with office@nstp.edu.ph / password123')
  }

  // Create a volunteer for testing the verification dashboard
  console.log('\nCreating Dummy Volunteer account...')
  const { data: volAuth, error: volErr } = await supabase.auth.signUp({
    email: 'juan@student.edu.ph',
    password: 'password123',
    options: {
      data: {
        full_name: 'Juan Dela Cruz',
        role: 'volunteer'
      }
    }
  })

  if (!volErr) {
    await new Promise(r => setTimeout(r, 1000))
    await supabase.from('users').update({ 
      nstp_component: 'CWTS',
      municipality: 'Prosperidad',
      barangay: 'Patin-ay'
    }).eq('id', volAuth.user.id)
    console.log('Dummy Volunteer created for verification testing.')
  }
}

createAdmin()
