const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup & Config
dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

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

// 3. Routes

// Health Check
app.get('/', (req, res) => {
    res.send('Cyber Mitra Backend is Live!');
});

/**
 * AI Chat Endpoint (Cyber Mitra)
 */
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    // Updated to use a model confirmed to be available in your account
    const MODEL_NAME = "gemini-2.5-flash"; 

    try {
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "API Key missing." });
        }

        const model = genAI.getGenerativeModel({ 
            model: MODEL_NAME,
            systemInstruction: `You are 'Cyber Mitra', an AI Assistant for the Uttar Pradesh Police Technical Services Portal. 
            Your goal is to help citizens of Uttar Pradesh report incidents and understand the portal.
            Be professional, helpful, and empathetic. Speak in a mix of Hindi and English (Hinglish).
            IMPORTANT: You are an AI assistant, not a police officer. For emergencies, tell them to call 112.`
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(message);
        const response = await result.response;
        
        res.json({ text: response.text() });
    } catch (error) {
        console.error(`Gemini Error (${MODEL_NAME}):`, error.message);
        res.status(500).json({ error: "AI failed to respond. Please try again." });
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
        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: "Report not found." });
            throw error;
        }
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
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(`${prompt}: "${text}"`);
        const response = await result.response;
        res.json({ result: response.text() });
    } catch (error) {
        console.error("AI Analyze Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
