/**
 * Cyber Mitra - AI Assistant Integration
 * Now refactored to use Secure Backend
 */

const BACKEND_URL = "https://cyber-mitra-backend.onrender.com";

const aiAssistant = {
    chatHistory: [],

    init: async function() {
        console.log("Cyber Mitra: Connecting to secure backend...");
        try {
            const res = await fetch(`${BACKEND_URL}/`);
            if (res.ok) {
                console.log("✅ Cyber Mitra: Connected to Backend.");
                const statusDot = document.querySelector('.status-dot');
                if (statusDot) statusDot.style.backgroundColor = '#2ecc71';
            }
        } catch (error) {
            console.error("Backend Connection Error:", error);
        }
    },

    /**
     * Send a message to Gemini via Backend
     */
    sendMessage: async function(userText) {
        this.addMessage("user", userText);
        const typingId = this.showTyping();

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: userText,
                    history: this.chatHistory 
                })
            });

            const data = await response.json();
            this.removeTyping(typingId);

            if (data.text) {
                this.addMessage("ai", data.text);
                // Update history
                this.chatHistory.push({ role: "user", parts: [{ text: userText }] });
                this.chatHistory.push({ role: "model", parts: [{ text: data.text }] });
            } else {
                this.addMessage("ai", "I'm having a bit of trouble thinking right now. Please try again.");
            }
        } catch (error) {
            this.removeTyping(typingId);
            console.error("Cyber Mitra Send Error:", error);
            this.addMessage("ai", "I couldn't reach the server. Please check your internet.");
        }
    },

    /**
     * AI Features via Proxy
     */
    analyzeWithAI: async function(prompt, text) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/ai/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, text })
            });
            const data = await response.json();
            return data.result || null;
        } catch (e) {
            return null;
        }
    },

    categorizeIncident: async function(description) {
        if (!description || description.length < 10) return;
        const prompt = `Which of these categories fits best: "Theft", "Cyber Crime", "Harassment", "Missing Person", or "Other"? Return ONLY the category name.`;
        const category = await this.analyzeWithAI(prompt, description);
        
        if (category) {
            const select = document.getElementById('incidentType');
            if (select) {
                for (let option of select.options) {
                    if (category.toLowerCase().includes(option.value.toLowerCase()) && option.value !== "") {
                        select.value = option.value;
                        select.style.borderColor = "#2ecc71";
                        setTimeout(() => select.style.borderColor = "", 2000);
                        break;
                    }
                }
            }
        }
    },

    generateAdminSummary: async function(description) {
        return await this.analyzeWithAI("Summarize this police incident report in exactly 2 concise sentences for an investigating officer", description);
    },

    translateToEnglish: async function(text) {
        return await this.analyzeWithAI("Translate the following text to English. If it is already in English, return it exactly as is", text);
    },

    assessUrgency: async function(description) {
        const res = await this.analyzeWithAI('Analyze this incident and return ONLY one word: "High", "Medium", or "Low" priority. High means violence or ongoing crime.', description);
        return res ? res.trim() : "Medium";
    },

    generateNextSteps: async function(type, description) {
        return await this.analyzeWithAI(`A citizen just reported a ${type} incident. Provide 3 bullet points of immediate "Next Steps" or safety advice`, description);
    },

    /**
     * UI Helpers
     */
    addMessage: function(sender, text) {
        const container = document.getElementById('ai-chat-messages');
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        div.textContent = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    showTyping: function() {
        const container = document.getElementById('ai-chat-messages');
        const div = document.createElement('div');
        const id = 'typing-' + Date.now();
        div.id = id;
        div.className = 'typing';
        div.textContent = 'Cyber Mitra is thinking...';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return id;
    },

    removeTyping: function(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('ai-chat-toggle');
    const closeBtn = document.getElementById('ai-chat-close');
    const chatWindow = document.getElementById('ai-chat-window');
    const sendBtn = document.getElementById('ai-send-btn');
    const userInput = document.getElementById('ai-user-input');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            chatWindow.classList.toggle('active');
            if (chatWindow.classList.contains('active')) userInput.focus();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            chatWindow.classList.remove('active');
        });
    }

    const handleSend = () => {
        const text = userInput.value.trim();
        if (text) {
            aiAssistant.sendMessage(text);
            userInput.value = '';
        }
    };

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (userInput) userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

    const descriptionArea = document.getElementById('description');
    if (descriptionArea) {
        descriptionArea.addEventListener('blur', () => {
            aiAssistant.categorizeIncident(descriptionArea.value);
        });
    }

    aiAssistant.init();
});

window.aiAssistant = aiAssistant;
