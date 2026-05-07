/**
 * UP Police Citizen Service & Incident Reporting Portal - Script
 * Refactored to use Secure Render Backend & Supabase
 */

const BACKEND_URL = "https://up-cyber-mitra-production.onrender.com";
// Replace with your actual Supabase credentials
const SUPABASE_URL = "https://psusshcvadbbjbhgngxw.supabase.co";
const SUPABASE_KEY = "sb_publishable_HuUL2f5Me4pZ1Eo3nUnsfQ_rrIe-Eui"; 

const app = {
    // Current state
    complaints: [],
    
    init: function() {
        // 1. Initialize Auth first
        auth.init(SUPABASE_URL, SUPABASE_KEY);
        
        this.loadData();
        this.attachEventListeners();
        console.log("UP Police Portal Initialized (v1.1.0-auth)");
    },

    /**
     * Get Headers with JWT Token
     */
    getAuthHeaders: function() {
        const token = auth.session?.access_token;
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    /**
     * Load data from Supabase via Backend
     */
    loadData: async function() {
        if (!auth.session) return; // Wait for login

        try {
            const response = await fetch(`${BACKEND_URL}/api/reports`, {
                headers: this.getAuthHeaders()
            });
            
            if (response.status === 403) {
                console.log("Not an admin, hiding admin view.");
                return;
            }

            this.complaints = await response.json();
            this.renderAdminTable();
            this.updateStats();
        } catch (error) {
            console.error("Failed to load reports:", error);
        }
    },

    navigateTo: function(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            window.scrollTo(0, 0);
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageId);
        });

        if (pageId === 'admin') this.loadData();
    },

    attachEventListeners: function() {
        const self = this;

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                self.navigateTo(link.dataset.page);
            });
        });

        const form = document.getElementById('incident-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                self.handleFormSubmission();
            });
        }

        const adminSearch = document.getElementById('adminSearch');
        if (adminSearch) {
            adminSearch.addEventListener('input', (e) => {
                self.renderAdminTable(e.target.value);
            });
        }

        const btnTrack = document.getElementById('btn-track');
        if (btnTrack) {
            btnTrack.addEventListener('click', () => self.handleTracking());
        }

        const mobileMenu = document.getElementById('mobile-menu');
        const navLinks = document.getElementById('nav-links');
        if (mobileMenu && navLinks) {
            mobileMenu.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
                navLinks.classList.toggle('active');
            });
        }
    },

    /**
     * Handle Form Submission
     */
    handleFormSubmission: async function() {
        const id = 'UPP-' + Math.floor(100000 + Math.random() * 900000);
        const description = document.getElementById('description').value;
        const type = document.getElementById('incidentType').value;

        const complaint = {
            id: id,
            name: document.getElementById('fullName').value,
            mobile: document.getElementById('mobile').value,
            email: document.getElementById('email').value,
            type: type,
            location: document.getElementById('location').value,
            description: description,
            status: 'Pending'
        };

        // Show Success Modal immediately (UX)
        document.getElementById('new-id').textContent = id;
        document.getElementById('success-modal').classList.add('active');

        try {
            // Check if user is logged in
            if (!auth.session) {
                auth.showModal();
                return;
            }

            // 1. Save to Database
            await fetch(`${BACKEND_URL}/api/reports`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(complaint)
            });

            // 2. AI Next Steps (Background)
            const adviceBox = document.getElementById('ai-next-steps');
            const adviceContent = document.getElementById('next-steps-content');
            if (adviceBox && adviceContent) {
                adviceBox.style.display = 'block';
                adviceContent.innerHTML = '🤖 Cyber Mitra is preparing safety advice...';
                const nextSteps = await aiAssistant.generateNextSteps(type, description);
                adviceContent.innerHTML = nextSteps ? nextSteps.replace(/\n/g, '<br>') : "Stay safe and wait for contact.";
            }

            // 3. AI Urgency & Translation
            const urgency = await aiAssistant.assessUrgency(description);
            const translation = await aiAssistant.translateToEnglish(description);
            
            // Update the record with AI data
            await fetch(`${BACKEND_URL}/api/reports/${id}`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    ai_urgency: urgency, 
                    ai_translation: translation 
                })
            });

            document.getElementById('incident-form').reset();
        } catch (error) {
            console.error("Submission error:", error);
        }
    },

    closeModal: function() {
        document.getElementById('success-modal').classList.remove('active');
        this.navigateTo('home');
    },

    handleTracking: async function() {
        const trackId = document.getElementById('trackId').value.trim().toUpperCase();
        const resultArea = document.getElementById('track-result');
        if (!trackId) return;

        try {
            const response = await fetch(`${BACKEND_URL}/api/reports/${trackId}`, {
                headers: this.getAuthHeaders()
            });
            if (response.ok) {
                const found = await response.json();
                resultArea.innerHTML = `
                    <div class="track-details">
                        <p><strong>Complaint ID:</strong> ${found.id}</p>
                        <p><strong>Status:</strong> <span class="badge badge-${found.status.toLowerCase().replace(' ', '-')}">${found.status}</span></p>
                        <p><strong>Filed On:</strong> ${new Date(found.created_at).toLocaleDateString()}</p>
                        <p><strong>Type:</strong> ${found.type}</p>
                        <hr>
                        <p><em>Latest: Your report is under review by Technical Services.</em></p>
                    </div>`;
            } else {
                resultArea.innerHTML = `<p style="color: red;">No record found with ID: ${trackId}</p>`;
            }
        } catch (e) {
            resultArea.innerHTML = `<p style="color: red;">Connection error.</p>`;
        }
    },

    renderAdminTable: function(filter = '') {
        const tbody = document.getElementById('admin-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        const filtered = this.complaints.filter(c => 
            c.id.toLowerCase().includes(filter.toLowerCase()) || 
            c.name.toLowerCase().includes(filter.toLowerCase())
        );

        filtered.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.id}</strong></td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td>${c.name}</td>
                <td>${c.type}</td>
                <td>${c.location}</td>
                <td><span class="badge badge-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span></td>
                <td><button class="btn btn-outline" onclick="app.viewDetails('${c.id}')">View</button></td>
            `;
            tbody.appendChild(tr);
        });
    },

    viewDetails: async function(id) {
        const found = this.complaints.find(c => c.id === id);
        if (!found) return;

        const summaryText = document.getElementById('ai-summary');
        const translationText = document.getElementById('ai-translation');
        const priorityBadge = document.getElementById('ai-priority-badge');
        
        if (summaryText) summaryText.innerHTML = "Generating AI Summary...";
        if (translationText) translationText.innerHTML = found.ai_translation || "No translation needed.";
        
        if (priorityBadge) {
            if (found.ai_urgency) {
                priorityBadge.innerHTML = `<span class="badge badge-${found.ai_urgency.toLowerCase()}">${found.ai_urgency} Priority</span>`;
            } else {
                priorityBadge.innerHTML = '<span class="badge badge-medium">Processing...</span>';
            }
        }

        document.getElementById('detail-content').innerHTML = `
            <strong>ID:</strong> <p>${found.id}</p>
            <strong>Status:</strong> <p>${found.status}</p>
            <strong>Reporter:</strong> <p>${found.name}</p>
            <strong>Incident:</strong> <p>${found.type}</p>
            <strong style="grid-column: 1/-1;">Description:</strong>
            <p style="grid-column: 1/-1; background: #f9f9f9; padding: 10px;">${found.description}</p>
            <div style="grid-column: 1/-1; margin-top: 15px;">
                <label>Update Status:</label>
                <select onchange="app.updateStatus('${found.id}', this.value)">
                    <option value="Pending" ${found.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${found.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Resolved" ${found.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
                </select>
                <button class="btn btn-danger" onclick="app.deleteReport('${found.id}')">Delete</button>
            </div>
        `;

        document.getElementById('detail-modal').classList.add('active');

        const summary = await aiAssistant.generateAdminSummary(found.description);
        if (summaryText) summaryText.innerHTML = summary || "Unavailable.";
        
        // If urgency was missing, let's try to get it now and update it
        if (!found.ai_urgency) {
            const urgency = await aiAssistant.assessUrgency(found.description);
            if (urgency && priorityBadge) {
                priorityBadge.innerHTML = `<span class="badge badge-${urgency.toLowerCase()}">${urgency} Priority</span>`;
                // Save it back to DB
                await fetch(`${BACKEND_URL}/api/reports/${id}`, {
                    method: 'PATCH',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ ai_urgency: urgency })
                });
            }
        }
    },

    updateStatus: async function(id, status) {
        try {
            await fetch(`${BACKEND_URL}/api/reports/${id}`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ status })
            });
            this.loadData();
        } catch (e) { console.error(e); }
    },

    deleteReport: async function(id) {
        if (!confirm("Delete this report?")) return;
        try {
            await fetch(`${BACKEND_URL}/api/reports/${id}`, { 
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            this.closeDetailModal();
            this.loadData();
        } catch (e) { console.error(e); }
    },

    closeDetailModal: function() {
        document.getElementById('detail-modal').classList.remove('active');
    },

    updateStats: function() {
        document.getElementById('stat-total').textContent = this.complaints.length;
        document.getElementById('stat-pending').textContent = this.complaints.filter(c => c.status === 'Pending').length;
        document.getElementById('stat-resolved').textContent = this.complaints.filter(c => c.status === 'Resolved').length;
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
