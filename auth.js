/**
 * Authentication and Session Management for UP Police Portal
 */

const auth = {
    // 1. Initialize Supabase Client
    supabase: null,
    session: null,

    init: function(supabaseUrl, supabaseKey) {
        this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
        this.attachEventListeners();
        this.checkSession();
    },

    /**
     * Check if user is already logged in
     */
    checkSession: async function() {
        const { data: { session } } = await this.supabase.auth.getSession();
        this.updateUI(session);

        // Listen for auth changes
        this.supabase.auth.onAuthStateChange((_event, session) => {
            this.updateUI(session);
        });
    },

    updateUI: async function(session) {
        this.session = session;
        const authButtons = document.getElementById('auth-buttons');
        const userProfile = document.getElementById('user-profile');
        const userDisplayName = document.getElementById('user-display-name');
        const adminLink = document.getElementById('nav-admin-li');

        if (session) {
            authButtons.style.display = 'none';
            userProfile.style.display = 'flex';
            userDisplayName.textContent = session.user.email.split('@')[0];
            
            // Check if user is Admin
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();
            
            if (profile && profile.is_admin) {
                adminLink.style.display = 'block';
            } else {
                adminLink.style.display = 'none';
            }
        } else {
            authButtons.style.display = 'block';
            userProfile.style.display = 'none';
            adminLink.style.display = 'none';
        }
    },

    // Modal UI Logic
    showModal: function() {
        document.getElementById('auth-modal').classList.add('active');
    },

    closeModal: function() {
        document.getElementById('auth-modal').classList.remove('active');
    },

    switchTab: function(tab) {
        const loginArea = document.getElementById('login-form-area');
        const signupArea = document.getElementById('signup-form-area');
        const tabs = document.querySelectorAll('.auth-tab');

        if (tab === 'login') {
            loginArea.style.display = 'block';
            signupArea.style.display = 'none';
            tabs[0].classList.add('active');
            tabs[1].classList.remove('active');
        } else {
            loginArea.style.display = 'none';
            signupArea.style.display = 'block';
            tabs[0].classList.remove('active');
            tabs[1].classList.add('active');
        }
    },

    /**
     * Auth Actions
     */
    signInWithGoogle: async function() {
        await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
    },

    handleEmailLogin: async function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const { error } = await this.supabase.auth.signInWithPassword({
            email, password
        });

        if (error) alert(error.message);
        else this.closeModal();
    },

    handleEmailSignup: async function(e) {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const name = document.getElementById('signup-name').value;

        const { error } = await this.supabase.auth.signUp({
            email, 
            password,
            options: {
                data: { full_name: name }
            }
        });

        if (error) alert(error.message);
        else {
            alert("Signup successful! Please check your email for verification.");
            this.closeModal();
        }
    },

    logout: async function() {
        await this.supabase.auth.signOut();
        window.location.reload();
    },

    attachEventListeners: function() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleEmailLogin(e));
        }

        const signupForm = document.getElementById('signup-form');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleEmailSignup(e));
        }
    }
};
