import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

const DEEPGRAM_API_KEY = Constants.expoConfig?.extra?.deepgramApiKey;
const OPENROUTER_API_KEY = Constants.expoConfig?.extra?.openrouterApiKey;

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
        if (!OPENROUTER_API_KEY) return "Summary functionality is currently unavailable (API key missing).";

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3.2-3b-instruct:free',
                    messages: [
                        { role: 'user', content: `Summarize this lecture transcript in clear bullet points:\n\n${text}` }
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

    async generateFlashcards(text) {
        if (!OPENROUTER_API_KEY) return [];

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3.2-3b-instruct:free',
                    messages: [
                        { role: 'user', content: `Based on the following transcript, generate 5 flashcards as a JSON array of objects with "question" and "answer" keys. Return ONLY the JSON array.\n\n${text}` }
                    ],
                }),
            });

            const data = await response.json();
            let content = data.choices?.[0]?.message?.content || "[]";

            // Clean up potential markdown code blocks
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
    }
};
