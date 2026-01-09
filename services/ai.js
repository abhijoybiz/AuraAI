import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

const DEEPGRAM_API_KEY = Constants.expoConfig?.extra?.deepgramApiKey;
const GROQ_API_KEY = Constants.expoConfig?.extra?.groqApiKey;

export const aiService = {
    async transcribeAudio(uri) {
        if (!DEEPGRAM_API_KEY) {
            throw new Error('Deepgram API key missing');
        }

        try {
            const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

            // Convert base64 to binary for Deepgram
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const response = await fetch('https://api.deepgram.com/v1/listen?punctuate=true&utterances=true&smart_format=true', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': 'audio/wav',
                },
                body: bytes,
            });

            const data = await response.json();

            if (data.results?.channels?.[0]?.alternatives?.[0]) {
                const alt = data.results.channels[0].alternatives[0];
                const transcript = alt.transcript;

                let segments = [];
                if (data.results?.utterances) {
                    segments = data.results.utterances.map(u => ({
                        text: u.transcript,
                        start: u.start,
                        end: u.end
                    }));
                } else {
                    segments = [{ text: transcript, start: 0, end: 0 }];
                }

                return { transcript, segments };
            } else {
                throw new Error('No transcription results');
            }
        } catch (error) {
            console.error('Transcription error:', error);
            throw error;
        }
    },

    async generateSummary(text) {
        if (!GROQ_API_KEY) return "Summary functionality is currently unavailable (API key missing).";

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
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

${text}`
                        }
                    ],
                }),
            });

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "Could not generate summary.";
        } catch (e) {
            console.error('Summary generation error:', e);
            return "Error generating summary.";
        }
    },

    async generateFlashcards(text, count = 5) {
        if (!GROQ_API_KEY) return [];

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'user',
                            content: `Based on the following transcript, generate ${count} flashcards as a JSON array of objects with "question" and "answer" keys. Ensure they cover the most important concepts. Return ONLY the JSON array.\n\nTranscript:\n${text}`
                        }
                    ],
                }),
            });

            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || "[]";

            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const start = content.indexOf('[');
            const end = content.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                content = content.substring(start, end + 1);
                return JSON.parse(content);
            }
            return [];
        } catch (e) {
            console.error('Flashcard generation error:', e);
            return [];
        }
    },

    async generateQuiz(text, count = 5) {
        if (!GROQ_API_KEY) return [];

        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'user',
                            content: `Based on the following transcript, generate a multiple-choice quiz with ${count} questions. Return as a JSON array where each object has "question", "options" (array of 2-4 strings), and "correctAnswer" (string, must match one of the options). Return ONLY the JSON array.\n\nTranscript:\n${text}`
                        }
                    ],
                }),
            });

            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || "[]";

            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            const start = content.indexOf('[');
            const end = content.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                content = content.substring(start, end + 1);
                return JSON.parse(content);
            }
            return [];
        } catch (e) {
            console.error('Quiz generation error:', e);
            return [];
        }
    },

    async chat(messages, transcript) {
        if (!GROQ_API_KEY) return "I'm sorry, I cannot chat right now (API key missing).";

        try {
            // Clean up messages to only include role and content (some APIs are strict)
            const cleanedMessages = messages.map(({ role, content }) => ({ role, content }));

            const systemPrompt = {
                role: 'system',
                content: `You are "Memry", a professional and encouraging AI study assistant. 
                
                TRANSCRIPT CONTEXT:
                ${transcript || "No transcript available for this lecture."}
                
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
            };

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [systemPrompt, ...cleanedMessages],
                    temperature: 0.7,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Groq API Error:', response.status, errorData);
                return "I'm having trouble connecting to my brain right now. Please try again in a moment.";
            }

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content;

            if (!reply) {
                return "I processed your request but couldn't think of a response. Could you rephrase?";
            }

            return reply;
        } catch (e) {
            console.error('Chat service error:', e);
            return "An unexpected error occurred. Please check your connection and try again.";
        }
    }
};
