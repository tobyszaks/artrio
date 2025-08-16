import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Profile {
  user_id: string;
  birthday: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting trio randomization process...')

    // Get today's date
    const today = new Date().toISOString().split('T')[0]
    console.log('Processing date:', today)

    // Check if trios already exist for today
    const { data: existingTrios, error: checkError } = await supabaseClient
      .from('trios')
      .select('id')
      .eq('date', today)
      .limit(1)

    if (checkError) {
      console.error('Error checking existing trios:', checkError)
      throw checkError
    }

    if (existingTrios && existingTrios.length > 0) {
      console.log('Trios already exist for today, skipping...')
      return new Response(
        JSON.stringify({ message: 'Trios already exist for today' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Get all eligible profiles (users who are at least 15 years old)
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('user_id, birthday, created_at')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    if (!profiles || profiles.length < 3) {
      console.log('Not enough users to form trios')
      return new Response(
        JSON.stringify({ message: 'Not enough users to form trios' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`Found ${profiles.length} profiles`)

    // Calculate age and filter eligible users
    const calculateAge = (birthday: string): number => {
      const birthDate = new Date(birthday)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      return age
    }

    const eligibleProfiles = profiles.filter((profile: Profile) => {
      const age = calculateAge(profile.birthday)
      return age >= 15
    })

    console.log(`Found ${eligibleProfiles.length} eligible profiles (age 15+)`)

    if (eligibleProfiles.length < 3) {
      console.log('Not enough eligible users to form trios')
      return new Response(
        JSON.stringify({ message: 'Not enough eligible users to form trios' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Shuffle the eligible profiles randomly
    const shuffled = [...eligibleProfiles].sort(() => Math.random() - 0.5)
    
    // Group into trios
    const trios = []
    for (let i = 0; i < shuffled.length - 2; i += 3) {
      if (i + 2 < shuffled.length) {
        trios.push({
          user1_id: shuffled[i].user_id,
          user2_id: shuffled[i + 1].user_id,
          user3_id: shuffled[i + 2].user_id,
          date: today
        })
      }
    }

    if (trios.length === 0) {
      console.log('No complete trios could be formed')
      return new Response(
        JSON.stringify({ message: 'No complete trios could be formed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`Creating ${trios.length} trios`)

    // Insert the new trios
    const { error: insertError } = await supabaseClient
      .from('trios')
      .insert(trios)

    if (insertError) {
      console.error('Error inserting trios:', insertError)
      throw insertError
    }

    console.log(`Successfully created ${trios.length} trios for ${today}`)

    // Clean up expired posts and replies
    const { error: cleanupError } = await supabaseClient.rpc('cleanup_expired_content')
    
    if (cleanupError) {
      console.error('Error cleaning up expired content:', cleanupError)
      // Don't throw here, trio creation was successful
    } else {
      console.log('Successfully cleaned up expired content')
    }

    return new Response(
      JSON.stringify({ 
        message: 'Trio randomization completed successfully',
        trios_created: trios.length,
        date: today
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in trio randomization:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})