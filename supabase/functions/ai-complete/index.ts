// supabase/functions/ai-complete/index.ts
// Edge Function for AI completions (summary, flashcards, quiz, notes, chat) using Groq API
// Secrets required: GROQ_API_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

serve(async (req) => {
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
            return new Response(JSON.stringify({ error: 'User profile not found. Please contact support.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (!profile?.is_whitelisted || !profile?.is_active) {
            console.log('User not whitelisted or inactive:', user.id)
            return new Response(JSON.stringify({ error: 'Access denied' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log('User whitelisted, proceeding with AI request')

        const { action, payload } = await req.json()
        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

        if (!GROQ_API_KEY) {
            console.error('GROQ_API_KEY not configured')
            return new Response(JSON.stringify({ error: 'AI service not configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        let messages: Message[] = []
        let model = 'llama-3.3-70b-versatile'
        let temperature = 0.7
        let maxTokens = 2048

        // Build prompt based on action type
        switch (action) {
            case 'summary':
                messages = [{
                    role: 'user',
                    content: `You are a professional educational assistant. Summarize the following lecture transcript using VERY RICH Markdown formatting:

- Use **bold** for key terms and important concepts
- Use ## H2 and ### H3 headers to organize sections
- Use bullet points for unstructured lists
- Use numbered lists (1. 2. 3.) for sequences, steps, or rankings
- Use > blockquotes for important takeaways or quotes
- Use --- for horizontal rules between major topics
- Use inline \`code\` for technical terms or formulas
- Use tables for comparisons when applicable
- Use *italics* for emphasis

Here is the transcript to summarize:

${payload.text}`
                }]
                break

            case 'flashcards':
                messages = [{
                    role: 'user',
                    content: `Based on the following transcript, generate exactly ${payload.count || 5} flashcards as a JSON array of objects with "question" and "answer" keys. Ensure they cover the most important concepts. Return ONLY the JSON array starting with [ and ending with ].\n\nTranscript:\n${payload.text}`
                }]
                break

            case 'quiz':
                messages = [{
                    role: 'user',
                    content: `Based on the following transcript, generate a multiple-choice quiz with exactly ${payload.count || 5} questions. Return as a JSON array where each object has "question", "options" (array of 2-4 strings), and "correctAnswer" (string, must match one of the options). Return ONLY the JSON array starting with [ and ending with ].\n\nTranscript:\n${payload.text}`
                }]
                break

            case 'notes':
                messages = [{
                    role: 'user',
                    content: `Based on the following transcript, generate comprehensive study notes in a Notion-like structure. 
                    Return as a JSON array where each object has "type" (choose from: "h1", "h2", "paragraph", "bullet", "numbered") and "content" (string). 
                    - Use "h1" for the most important overarching topics.
                    - Use "h2" for secondary sub-topics and sections.
                    - Use "bullet" for unstructured lists of points or facts.
                    - Use "numbered" for sequences, hierarchies, or chronological steps.
                    - Use "paragraph" for narrative explanations and context.
                    IMPORTANT: Within the "content" string, you SHOULD use **bold** for key concepts and *italics* for emphasis or definitions.
                    Ensure the notes are logically organized, professional, and academically rigorous. Return ONLY the JSON array starting with [ and ending with ].\n\nTranscript:\n${payload.text}`
                }]
                break

            case 'modify_notes':
                messages = [{
                    role: 'user',
                    content: `You are an expert editor. Modify the following study notes based on this instruction: "${payload.userPrompt}". 
                    
                    Current notes (JSON format):
                    ${JSON.stringify(payload.currentBlocks)}
                    
                    Instructions:
                    1. Follow the user's request exactly (e.g., summarize, expand, simplify, reformat).
                    2. Return the UPDATED notes as a JSON array where each object has "type" (h1, h2, paragraph, bullet, numbered) and "content" (string). 
                    3. Maintain the Notion-like structure and rich formatting (**bold**, *italics*).
                    4. Return ONLY the valid JSON array starting with [ and ending with ]. No explanations.`
                }]
                break

            case 'chat':
                model = 'llama-3.1-8b-instant'
                maxTokens = 1024
                messages = [
                    {
                        role: 'system',
                        content: `You are "Memry", a professional and encouraging AI study assistant. 
                        
                        TRANSCRIPT CONTEXT:
                        ${payload.transcript || "No transcript available for this lecture."}
                        
                        GUIDELINES:
                        1. Answer questions strictly based on the provided transcript context.
                        2. Be concise, clear, and educational.
                        3. Use rich Markdown formatting: **bold** for key concepts, \`code\` for technical terms, and bullet points for lists.
                        4. If the user asks for materials (flashcards, quizzes, notes, or journey maps), YOU MUST include the specific trigger tag at the end of your message.
                        
                        TRIGGER TAGS:
                        - For Flashcards: [ACTION:FLASHCARDS]
                        - For Quizzes/Tests: [ACTION:QUIZ]
                        - For Study Notes: [ACTION:NOTES]
                        - For Journey Maps/Learning Paths: [ACTION:JOURNEY]
                        
                        Example: "I've analyzed the lecture and created some flashcards for you. [ACTION:FLASHCARDS]"`
                    },
                    ...payload.messages
                ]
                break

            default:
                return new Response(JSON.stringify({ error: 'Invalid action' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
        }

        // Call Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('Groq API error:', response.status, errorData)
            throw new Error(errorData.error?.message || `API Error: ${response.status}`)
        }

        const data = await response.json()

        // Log usage
        await supabaseClient.from('ai_usage').insert({
            user_id: user.id,
            action_type: action,
            tokens_used: data.usage?.total_tokens || 0
        })

        return new Response(JSON.stringify({
            content: data.choices?.[0]?.message?.content,
            usage: data.usage
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('AI completion error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
