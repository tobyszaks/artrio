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
    
    // Group into trios with dynamic sizing for remainders
    const groups = []
    const totalUsers = shuffled.length
    
    // Calculate how many complete groups of 3 we can make
    const completeGroups = Math.floor(totalUsers / 3)
    const remainingUsers = totalUsers % 3
    
    let userIndex = 0
    
    // Create complete groups of 3
    for (let i = 0; i < completeGroups; i++) {
      groups.push({
        user1_id: shuffled[userIndex].user_id,
        user2_id: shuffled[userIndex + 1].user_id,
        user3_id: shuffled[userIndex + 2].user_id,
        user4_id: null,
        user5_id: null,
        date: today
      })
      userIndex += 3
    }
    
    // Handle remaining users
    if (remainingUsers > 0) {
      if (remainingUsers === 1 && groups.length > 0) {
        // Add the remaining user to the last group (making it a group of 4)
        groups[groups.length - 1].user4_id = shuffled[userIndex].user_id
      } else if (remainingUsers === 2 && groups.length > 0) {
        // Add the remaining 2 users to the last group (making it a group of 5)
        groups[groups.length - 1].user4_id = shuffled[userIndex].user_id
        groups[groups.length - 1].user5_id = shuffled[userIndex + 1].user_id
      } else if (remainingUsers === 2 && groups.length === 0) {
        // If we only have 2 users total, they don't get a group (need at least 3)
        console.log('Only 2 users available - insufficient for group formation')
      }
    }

    if (groups.length === 0) {
      console.log('No complete groups could be formed')
      return new Response(
        JSON.stringify({ message: 'No complete groups could be formed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`Creating ${groups.length} groups`)

    // Insert the new groups
    const { error: insertError } = await supabaseClient
      .from('trios')
      .insert(groups)

    if (insertError) {
      console.error('Error inserting groups:', insertError)
      throw insertError
    }

    console.log(`Successfully created ${groups.length} groups for ${today}`)

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
        message: 'Group randomization completed successfully',
        groups_created: groups.length,
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