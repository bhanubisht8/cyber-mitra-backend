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
app.use(cors()); // Allows all origins for development/prototype
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

    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("DEBUG: GEMINI_API_KEY is missing!");
            return res.status(500).json({ error: "API Key missing." });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are 'Cyber Mitra', a helpful AI Assistant for UP Police. Speak in Hinglish."
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(message);
        const response = await result.response;
        
        res.json({ text: response.text() });
    } catch (error) {
        console.error("DEBUG: Gemini API Error:", error.message || error);
        res.status(500).json({ error: "AI Error: " + (error.message || "Failed to respond") });
    }
});

/**
 * Save Incident Report
 */
app.post('/api/reports', async (req, res) => {
    const reportData = req.body;

    try {
        console.log("DEBUG: Attempting save to Supabase:", reportData.id);
        const { data, error } = await supabase
            .from('reports')
            .insert([reportData])
            .select();

        if (error) {
            console.error("DEBUG: Supabase Insert Error:", error);
            return res.status(500).json({ error: error.message });
        }
        
        console.log("DEBUG: Supabase Success! Data returned:", data);
        res.json({ success: true, data });
    } catch (error) {
        console.error("DEBUG: Backend Save Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get Report by ID (Tracking)
 */
app.get('/api/reports/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('id', id.toUpperCase())
            .single();

        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: "Report not found." });
            throw error;
        }
        res.json(data);
    } catch (error) {
        console.error("Supabase Fetch Error:", error);
        res.status(500).json({ error: "Database error." });
    }
});

/**
 * Get All Reports (Admin Dashboard)
 */
app.get('/api/reports', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error("Supabase List Error:", error);
        res.status(500).json({ error: "Failed to fetch reports." });
    }
});

/**
 * Update Report (Status, AI Insights, etc.)
 */
app.patch('/api/reports/:id', async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
        const { data, error } = await supabase
            .from('reports')
            .update(updateData)
            .eq('id', id.toUpperCase())
            .select();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error("Supabase Update Error:", error);
        res.status(500).json({ error: "Failed to update report." });
    }
});

/**
 * Delete Report
 */
app.delete('/api/reports/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('reports')
            .delete()
            .eq('id', id.toUpperCase());

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error("Supabase Delete Error:", error);
        res.status(500).json({ error: "Failed to delete report." });
    }
});

/**
 * AI Features Proxy (Urgency, Summary, Next Steps)
 */
app.post('/api/ai/analyze', async (req, res) => {
    const { prompt, text } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`${prompt}: "${text}"`);
        const response = await result.response;
        res.json({ result: response.text() });
    } catch (error) {
        console.error("DEBUG: AI Analyze Error:", error.message);
        res.status(500).json({ error: "AI Error: " + error.message });
    }
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
