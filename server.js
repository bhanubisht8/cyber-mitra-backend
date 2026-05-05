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
            console.error("DEBUG: GEMINI_API_KEY is missing in environment variables!");
            return res.status(500).json({ error: "Server Configuration Error: API Key missing." });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
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
        console.error("DEBUG: Gemini API Error:", error.message || error);
        res.status(500).json({ error: error.message || "AI failed to respond." });
    }
});

/**
 * Save Incident Report
 */
app.post('/api/reports', async (req, res) => {
    const reportData = req.body;

    try {
        console.log("DEBUG: Attempting to save report to Supabase:", reportData.id);
        const { data, error } = await supabase
            .from('reports')
            .insert([reportData])
            .select();

        if (error) {
            console.error("DEBUG: Supabase Insert Error Details:", error);
            throw error;
        }
        
        console.log("DEBUG: Report saved successfully:", reportData.id);
        res.json({ success: true, data });
    } catch (error) {
        console.error("DEBUG: Backend Save Error:", error.message || error);
        res.status(500).json({ error: error.message || "Failed to save report." });
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
    const { type, prompt, text } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const fullPrompt = `${prompt}: "${text}"`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        res.json({ result: response.text() });
    } catch (error) {
        console.error("AI Analysis Error:", error);
        res.status(500).json({ error: "AI analysis failed." });
    }
});

// 4. Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
