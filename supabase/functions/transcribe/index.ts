// supabase/functions/transcribe/index.ts
// Edge Function for audio transcription using Deepgram API
// Secrets required: DEEPGRAM_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Create client with user's JWT for authentication
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            console.error('No Authorization header provided')
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

        if (authError) {
            console.error('Auth error:', authError.message)
            return new Response(JSON.stringify({ error: 'Authentication failed: ' + authError.message }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!user) {
            console.error('No user found in token')
            return new Response(JSON.stringify({ error: 'Unauthorized - no user' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('Authenticated user:', user.id)

        // Use service role client for database queries (bypasses RLS)
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        // Check whitelist
        const { data: profile, error: profileError } = await adminClient
            .from('users')
            .select('is_whitelisted, is_active')
            .eq('id', user.id)
            .single()

        if (profileError) {
            console.error('Profile lookup error:', profileError.message)
            // If user doesn't exist in users table, they're not whitelisted
            return new Response(JSON.stringify({ error: 'User profile not found. Please contact support.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!profile?.is_whitelisted || !profile?.is_active) {
            console.log('User not whitelisted or inactive:', user.id)
            return new Response(JSON.stringify({ error: 'Access denied. Please contact support.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('User whitelisted, proceeding with transcription')

        // Get the audio data from request
        const { audioBase64 } = await req.json()

        if (!audioBase64) {
            return new Response(JSON.stringify({ error: 'No audio data provided' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Convert base64 to binary
        const binaryString = atob(audioBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
        }

        // Call Deepgram API (key is stored in Supabase secrets)
        const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')

        if (!DEEPGRAM_API_KEY) {
            console.error('DEEPGRAM_API_KEY not configured')
            return new Response(JSON.stringify({ error: 'Transcription service not configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const response = await fetch(
            'https://api.deepgram.com/v1/listen?punctuate=true&utterances=true&smart_format=true',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': 'audio/wav',
                },
                body: bytes,
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.error('Deepgram API error:', response.status, errorText)
            return new Response(JSON.stringify({ error: 'Transcription failed' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const data = await response.json()

        // Log usage for future billing
        await supabaseClient.from('ai_usage').insert({
            user_id: user.id,
            action_type: 'transcribe',
            tokens_used: Math.ceil(data.metadata?.duration || 0)
        })

        // Parse response
        if (data.results?.channels?.[0]?.alternatives?.[0]) {
            const alt = data.results.channels[0].alternatives[0]
            const transcript = alt.transcript

            let segments: Array<{ text: string; start: number; end: number }> = []
            if (data.results?.utterances) {
                segments = data.results.utterances.map((u: any) => ({
                    text: u.transcript,
                    start: u.start,
                    end: u.end
                }))
            } else {
                segments = [{ text: transcript, start: 0, end: 0 }]
            }

            return new Response(JSON.stringify({ transcript, segments }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ error: 'No transcription results' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Transcription error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
