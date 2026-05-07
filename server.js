const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup & Config
dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const APP_VERSION = "1.1.1-stable";

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// JWKS Client for Modern Supabase Auth (ECC P-256)
const client = jwksClient({
  jwksUri: `${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  cache: true,
  rateLimit: true
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function(err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. Middleware
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Serve static files from the root directory
const publicPath = path.resolve(__dirname);
app.use(express.static(publicPath));

/**
 * Middleware: Authenticate User
 */
const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Authentication required" });

    jwt.verify(token, getKey, { algorithms: ['ES256'] }, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Invalid token" });
        req.user = decoded;
        next();
    });
};

/**
 * Middleware: Check if User is Admin
 */
const requireAdmin = async (req, res, next) => {
    try {
        const { data: profile, error } = await supabase.from('profiles').select('is_admin').eq('id', req.user.sub).single();
        if (error || !profile?.is_admin) return res.status(403).json({ error: "Admin access required" });
        next();
    } catch (error) {
        res.status(500).json({ error: "Authorization failed" });
    }
};

/**
 * Helper: AI Retry Logic
 */
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
        const errorMsg = error.message || '';
        const isTransient = errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('500');
        
        if (isTransient && retries > 0) {
            const delay = errorMsg.includes('429') ? 5000 : 2000;
            console.log(`DEBUG: Gemini Error (${errorMsg}). Retrying in ${delay/1000}s...`);
            await new Promise(r => setTimeout(r, delay));
            return callGeminiWithRetry(modelObj, method, payload, retries - 1);
        }
        throw error;
    }
}

// 3. API Routes

/**
 * Diagnostic: List Available Models via Direct API Call
 */
app.get('/api/ai/models', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "API Key missing." });

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error?.message || "Failed to fetch models");

        res.json({ 
            success: true, 
            count: data.models ? data.models.length : 0,
            models: data.models || []
        });
    } catch (error) {
        console.error("Direct ListModels Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * AI Chat Endpoint (Cyber Mitra)
 */
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    const MODEL_NAME = "gemini-1.5-flash"; 

    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("CRITICAL: GEMINI_API_KEY is missing in environment variables.");
            return res.status(500).json({ error: "API Key configuration error." });
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
        console.error(`Gemini Chat Error (${MODEL_NAME}):`, error.message);
        
        // Detailed error context for the user to troubleshoot region/key issues
        let userError = "Cyber Mitra is currently busy. Please try again later.";
        if (error.message.includes('location')) {
            userError = "AI service is not available in the current server region. Please contact support.";
        } else if (error.message.includes('API key')) {
            userError = "AI configuration error. Please check API settings.";
        }

        res.status(500).json({ error: userError, details: error.message });
    }
});

app.post('/api/reports', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase.from('reports').insert([{ ...req.body, user_id: req.user.sub }]).select();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error("Report Save Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/reports/:id', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase.from('reports').select('*').eq('id', req.params.id.toUpperCase()).single();
        if (error) return res.status(404).json({ error: "Not found" });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * AI Features Proxy
 */
app.post('/api/ai/analyze', authenticateUser, async (req, res) => {
    const { prompt, text } = req.body;
    const MODEL_NAME = "gemini-1.5-flash";

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const response = await callGeminiWithRetry(model, 'generate', [`${prompt}:`, text]);
        res.json({ result: response.text() });
    } catch (error) {
        console.error(`AI Analyze Error (${MODEL_NAME}):`, error.message);
        res.status(500).json({ error: "AI Analysis failed.", details: error.message });
    }
});

// 4. Frontend Serving (MUST BE LAST)

// Handle the root
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Handle ALL other routes (SPA Fallback)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (v${APP_VERSION})`);
});
