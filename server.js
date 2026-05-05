const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup & Config
dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const APP_VERSION = "1.0.6-final-stable";

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. Middleware
app.use(cors());
app.use(express.json());

// Helper: AI Retry Logic
async function callGeminiWithRetry(modelObj, method, payload, retries = 2) {
    try {
        if (method === 'chat') {
            const chat = modelObj.startChat({ history: payload.history || [] });
            const result = await chat.sendMessage(payload.message);
            return await result.response;
        } else {
            const result = await modelObj.generateContent(payload);
            return await result.response;
        }
    } catch (error) {
        const isTransient = error.message.includes('503') || error.message.includes('429');
        if (isTransient && retries > 0) {
            const delay = error.message.includes('429') ? 5000 : 2000;
            console.log(`DEBUG: Gemini ${error.message.includes('429') ? '429' : '503'}. Retrying in ${delay/1000}s...`);
            await new Promise(r => setTimeout(r, delay));
            return callGeminiWithRetry(modelObj, method, payload, retries - 1);
        }
        throw error;
    }
}

// 3. Routes

// Health Check
app.get('/', (req, res) => {
    res.send(`Cyber Mitra Backend is Live! (v${APP_VERSION})`);
});

/**
 * AI Chat Endpoint (Cyber Mitra)
 */
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    // 'gemini-flash-latest' is the most stable alias found in your ListModels output
    const MODEL_NAME = "gemini-flash-latest"; 

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "API Key missing." });
        }

        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: `You are 'Cyber Mitra', an AI Assistant for the Uttar Pradesh Police Technical Services Portal. 
            Speak in Hinglish (Hindi + English). Be professional and empathetic. 
            IMPORTANT: You are an AI, for emergencies call 112.`
        });

        const response = await callGeminiWithRetry(model, 'chat', { message, history });
        res.json({ text: response.text() });
    } catch (error) {
        console.error(`Gemini Error (${MODEL_NAME}):`, error.message);
        const errorMsg = error.message.includes('429') 
            ? "AI is a bit busy. Please wait a moment." 
            : "AI service is currently busy. Please try again.";
        res.status(500).json({ error: errorMsg });
    }
});

/**
 * Save Incident Report
 */
app.post('/api/reports', async (req, res) => {
    const reportData = req.body;
    try {
        const { data, error } = await supabase.from('reports').insert([reportData]).select();
        if (error) {
            console.error("Supabase Save Error:", error);
            return res.status(500).json({ error: error.message });
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get Report by ID (Tracking)
 */
app.get('/api/reports/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from('reports').select('*').eq('id', id.toUpperCase()).single();
        if (error) return res.status(404).json({ error: "Not found" });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get All Reports (Admin Dashboard)
 */
app.get('/api/reports', async (req, res) => {
    try {
        const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update Report
 */
app.patch('/api/reports/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase.from('reports').update(req.body).eq('id', id.toUpperCase()).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Delete Report
 */
app.delete('/api/reports/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('reports').delete().eq('id', id.toUpperCase());
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * AI Features Proxy
 */
app.post('/api/ai/analyze', async (req, res) => {
    const { prompt, text } = req.body;
    const MODEL_NAME = "gemini-flash-latest";

    if (!prompt || !text) {
        return res.status(400).json({ error: "Missing prompt or text." });
    }

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const response = await callGeminiWithRetry(model, 'generate', [`${prompt}:`, text]);
        res.json({ result: response.text() });
    } catch (error) {
        console.error(`AI Analyze Error (${MODEL_NAME}):`, error.message);
        res.status(500).json({ error: "AI Analysis failed." });
    }
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (v${APP_VERSION})`);
});
