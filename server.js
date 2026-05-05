const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup & Config
dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const APP_VERSION = "1.0.3-debug";

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Diagnostic: List Models
async function listModels() {
    console.log(`DEBUG [${APP_VERSION}]: Checking available models...`);
    try {
        const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await result.json();
        
        if (data.error) {
            console.error("DEBUG: Google API returned an error:", data.error);
        } else {
            console.log("DEBUG: Full Google Model List Response:", JSON.stringify(data).substring(0, 500) + "...");
            console.log("DEBUG: Models Summary:", data.models ? data.models.map(m => m.name.split('/').pop()) : "None");
        }
    } catch (e) {
        console.error("DEBUG: Failed to list models:", e.message);
    }
}
listModels();

// 2. Middleware
app.use(cors());
app.use(express.json());

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
    // Using 'gemini-pro' as it is the most compatible across all regions/keys
    const MODEL_NAME = "gemini-pro"; 

    try {
        console.log(`DEBUG [${APP_VERSION}]: Chat request received. Using model: ${MODEL_NAME}`);
        
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "API Key missing." });
        }

        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: "You are 'Cyber Mitra', a helpful AI Assistant for UP Police. Speak in Hinglish."
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(message);
        const response = await result.response;
        
        res.json({ text: response.text() });
    } catch (error) {
        console.error(`DEBUG [${APP_VERSION}]: Gemini Error with ${MODEL_NAME}:`, error.message);
        res.status(500).json({ error: `AI Error (${MODEL_NAME}): ` + error.message });
    }
});

/**
 * Save Incident Report
 */
app.post('/api/reports', async (req, res) => {
    const reportData = req.body;
    try {
        console.log("DEBUG: Saving report:", reportData.id);
        const { data, error } = await supabase.from('reports').insert([reportData]).select();
        if (error) {
            console.error("DEBUG: Supabase Error:", error);
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
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(`${prompt}: "${text}"`);
        const response = await result.response;
        res.json({ result: response.text() });
    } catch (error) {
        console.error("DEBUG: AI Analyze Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (v${APP_VERSION})`);
});
