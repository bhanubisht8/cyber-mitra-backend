/**
 * UP Police Citizen Service & Incident Reporting Portal - Script
 * Refactored to use Secure Render Backend & Supabase
 */

const BACKEND_URL = "https://cyber-mitra-backend.onrender.com";

const app = {
    // Current state
    complaints: [],
    
    init: function() {
        this.loadData();
        this.attachEventListeners();
        console.log("UP Police Portal Initialized (Full-Stack)");
    },

    /**
     * Load data from Supabase via Backend
     */
    loadData: async function() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/reports`);
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
            // 1. Save to Database
            await fetch(`${BACKEND_URL}/api/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            await fetch(`${BACKEND_URL}/api/ai/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id, 
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
            const response = await fetch(`${BACKEND_URL}/api/reports/${trackId}`);
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
        
        if (summaryText) summaryText.innerHTML = "Generating AI Summary...";
        if (translationText) translationText.innerHTML = found.ai_translation || "No translation needed.";

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
    },

    updateStatus: async function(id, status) {
        try {
            await fetch(`${BACKEND_URL}/api/reports/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            this.loadData();
        } catch (e) { console.error(e); }
    },

    deleteReport: async function(id) {
        if (!confirm("Delete this report?")) return;
        try {
            await fetch(`${BACKEND_URL}/api/reports/${id}`, { method: 'DELETE' });
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
