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
const APP_VERSION = "1.1.0-fullstack-stable";

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

const requireAdmin = async (req, res, next) => {
    try {
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', req.user.sub).single();
        if (!profile?.is_admin) return res.status(403).json({ error: "Admin access required" });
        next();
    } catch (error) {
        res.status(500).json({ error: "Authorization failed" });
    }
};

// 3. API Routes

app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    const MODEL_NAME = "gemini-1.5-flash-latest"; 
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction: "You are Cyber Mitra..." });
        const result = await model.generateContent(message);
        res.json({ text: result.response.text() });
    } catch (error) {
        res.status(500).json({ error: "AI Busy" });
    }
});

app.post('/api/reports', authenticateUser, async (req, res) => {
    const { data, error } = await supabase.from('reports').insert([{ ...req.body, user_id: req.user.sub }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

app.get('/api/reports', authenticateUser, requireAdmin, async (req, res) => {
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/reports/:id', authenticateUser, async (req, res) => {
    const { data, error } = await supabase.from('reports').select('*').eq('id', req.params.id.toUpperCase()).single();
    if (error) return res.status(404).json({ error: "Not found" });
    res.json(data);
});

// 4. Frontend Serving (MUST BE LAST)

// Handle the root
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Handle ALL other routes (SPA Fallback)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: "API not found" });
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (v${APP_VERSION})`);
});
