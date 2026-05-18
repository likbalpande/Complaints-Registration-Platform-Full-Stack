const LOCAL_BACKEND_URL = 'http://localhost:3000';
const PROD_BACKEND_URL = 'https://complaints-registration-platform-full-ikpp.onrender.com';

const BACKEND_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? LOCAL_BACKEND_URL 
    : PROD_BACKEND_URL;
const API_BASE = `${BACKEND_BASE_URL}/api`;


// --- State ---
let user = null;
let currentView = 'loading';

// --- DOM Elements ---
const viewContainer = document.getElementById('view-container');
const navbar = document.getElementById('navbar');
const errorToast = document.getElementById('error-toast');
const adminLink = document.getElementById('nav-admin-dashboard');

// --- API Service ---
const api = {
    async call(endpoint, options = {}) {
        options.credentials = 'include';
        options.headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, options);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }
            return data;
        } catch (error) {
            showError(error.message);
            throw error;
        }
    }
};

// --- View Rendering ---
const views = {
    loading: () => `
        <div class="screen">
            <div class="loader"></div>
            <p>Connecting to server...</p>
        </div>
    `,

    register: () => `
        <div class="screen">
            <div class="card">
                <h2 style="margin-bottom: 0.5rem">Create Account</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem">Register to start filing complaints</p>
                <form id="register-form">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="reg-name" placeholder="John Doe" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="reg-email" placeholder="john@example.com" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Send OTP</button>
                    <p style="margin-top: 1.5rem; text-align: center; font-size: 0.9rem">
                        Already have an account? <a href="#" id="go-to-login" style="color: var(--primary)">Login</a>
                    </p>
                </form>
            </div>
        </div>
    `,

    otp: (email) => `
        <div class="screen">
            <div class="card">
                <h2>Verify Email</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem">Enter the 6-digit code sent to <b>${email}</b></p>
                <form id="otp-form">
                    <div class="form-group">
                        <label>OTP Code</label>
                        <input type="text" id="otp-code" placeholder="123456" maxlength="6" required style="letter-spacing: 0.5rem; text-align: center; font-size: 1.5rem">
                    </div>
                    <button type="submit" class="btn btn-primary">Verify OTP</button>
                </form>
            </div>
        </div>
    `,

    passwordSetup: (email, otp) => `
        <div class="screen">
            <div class="card">
                <h2>Set Password</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem">Complete your registration</p>
                <form id="password-form">
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="pwd" placeholder="••••••••" required>
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" id="pwd-confirm" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Complete Registration</button>
                </form>
            </div>
        </div>
    `,

    login: () => `
        <div class="screen">
            <div class="card">
                <h2 style="margin-bottom: 0.5rem">Welcome Back</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem">Login to your account</p>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="login-email" placeholder="john@example.com" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="login-password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Login</button>
                    <p style="margin-top: 1.5rem; text-align: center; font-size: 0.9rem">
                        Don't have an account? <a href="#" id="go-to-register" style="color: var(--primary)">Register</a>
                    </p>
                </form>
            </div>
        </div>
    `,

    submitComplaint: () => `
        <div class="screen">
            <div class="card" style="max-width: 600px">
                <h2>File a Complaint</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem">Describe your issue clearly.</p>
                
                <div id="step-1">
                    <div class="form-group">
                        <label>What's the issue?</label>
                        <textarea id="complaint-text" rows="5" placeholder="Tell us what happened..."></textarea>
                    </div>
                    <button id="get-ai-btn" class="btn btn-primary">Get Follow-up Question</button>
                </div>

                <div id="step-2" class="hidden" style="margin-top: 2rem">
                    <div class="ai-section" style="margin-bottom: 1.5rem">
                        <p class="ai-question" id="ai-question-text"></p>
                    </div>
                    <div class="form-group">
                        <label>Your Answer</label>
                        <textarea id="ai-answer-text" rows="3" placeholder="Provide more details..."></textarea>
                    </div>
                    <button id="final-submit-btn" class="btn btn-primary">Submit Final Complaint</button>
                </div>
            </div>
        </div>
    `,

    myComplaints: (complaints) => `
        <div class="dashboard-container">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem">
                <h1>My Complaints</h1>
                <button class="btn btn-primary" style="width: auto; padding: 0.6rem 1.2rem" id="btn-new-complaint">Submit New</button>
            </div>
            ${complaints.length === 0 ? '<p style="text-align: center; color: var(--text-muted)">No complaints found.</p>' :
            complaints.map(c => `
                <div class="complaint-card">
                    <div class="complaint-header">
                        <span>Submitted on ${new Date(c.createdAt).toLocaleDateString()}</span>
                        <span class="admin-badge" style="background: var(--primary)">User</span>
                    </div>
                    <p class="complaint-text">${c.complaintText}</p>
                    <div class="ai-section">
                        <p class="ai-question">Q: ${c.aiQuestion}</p>
                        <p class="user-answer">A: ${c.userAnswer}</p>
                    </div>
                </div>
              `).join('')}
        </div>
    `,

    adminDashboard: (complaints) => `
        <div class="dashboard-container">
            <h1 style="margin-bottom: 2rem">Admin Dashboard</h1>
            ${complaints.length === 0 ? '<p style="text-align: center; color: var(--text-muted)">No complaints in the system.</p>' :
            complaints.map(c => `
                <div class="complaint-card">
                    <div class="complaint-header">
                        <span>By <b>${c.userName}</b> (${c.userEmail})</span>
                        <span>${new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p class="complaint-text">${c.complaintText}</p>
                    <div class="ai-section">
                        <p class="ai-question">Q: ${c.aiQuestion}</p>
                        <p class="user-answer">A: ${c.userAnswer}</p>
                    </div>
                </div>
              `).join('')}
        </div>
    `
};

// --- Navigation & State Management ---
function switchView(viewName, data = null) {
    currentView = viewName;
    viewContainer.innerHTML = '';

    switch (viewName) {
        case 'loading': viewContainer.innerHTML = views.loading(); break;
        case 'register': viewContainer.innerHTML = views.register(); break;
        case 'otp': viewContainer.innerHTML = views.otp(data.email); break;
        case 'passwordSetup': viewContainer.innerHTML = views.passwordSetup(data.email, data.otp); break;
        case 'login': viewContainer.innerHTML = views.login(); break;
        case 'submitComplaint': viewContainer.innerHTML = views.submitComplaint(); break;
        case 'myComplaints': viewContainer.innerHTML = views.myComplaints(data || []); break;
        case 'adminDashboard': viewContainer.innerHTML = views.adminDashboard(data || []); break;
    }

    attachEventListeners();
    updateNavbar();
}

function updateNavbar() {
    if (!user) {
        navbar.classList.add('hidden');
    } else {
        navbar.classList.remove('hidden');
        if (user.role === 'admin') {
            adminLink.classList.remove('hidden');
        } else {
            adminLink.classList.add('hidden');
        }
    }
}

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.remove('hidden');
    setTimeout(() => {
        errorToast.classList.add('hidden');
    }, 4000);
}

// --- Event Handlers ---
async function handleCheckSession() {
    try {
        const userData = await api.call('/auth/me');
        user = userData;
        if (user.role === 'admin') {
            handleViewAdminDashboard();
        } else {
            handleViewMyComplaints();
        }
    } catch (e) {
        user = null;
        switchView('login');
    }
}

async function handleViewMyComplaints() {
    try {
        const data = await api.call('/complaints/my');
        switchView('myComplaints', data);
    } catch (e) { }
}

async function handleViewAdminDashboard() {
    try {
        const data = await api.call('/admin/complaints');
        switchView('adminDashboard', data);
    } catch (e) { }
}

function attachEventListeners() {
    // Navigation
    const goLogin = document.getElementById('go-to-login');
    if (goLogin) goLogin.onclick = (e) => { e.preventDefault(); switchView('login'); };

    const goReg = document.getElementById('go-to-register');
    if (goReg) goReg.onclick = (e) => { e.preventDefault(); switchView('register'); };

    document.getElementById('nav-my-complaints')?.addEventListener('click', handleViewMyComplaints);
    document.getElementById('nav-submit-complaint')?.addEventListener('click', () => switchView('submitComplaint'));
    document.getElementById('nav-admin-dashboard')?.addEventListener('click', handleViewAdminDashboard);
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await api.call('/auth/logout', { method: 'POST' });
        user = null;
        switchView('login');
    });

    document.getElementById('btn-new-complaint')?.addEventListener('click', () => switchView('submitComplaint'));

    // Register
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        await api.call('/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ name, email })
        });
        switchView('otp', { email });
    });

    // OTP
    document.getElementById('otp-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = document.getElementById('otp-code').value;
        const email = currentView === 'otp' ? document.querySelector('b').textContent : ''; // Hacky way to get email
        switchView('passwordSetup', { email, otp });
    });

    // Password Setup
    document.getElementById('password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('pwd').value;
        const confirm = document.getElementById('pwd-confirm').value;
        if (pwd !== confirm) return showError('Passwords do not match');

        // We need to pass email and otp from previous step
        // In a real app we'd keep this in state
        const params = new URLSearchParams(); // placeholder for passing state
        // Let's use a global registration state
        const email = regState.email;
        const otp = regState.otp;

        await api.call('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, otp, password: pwd })
        });
        showError('Registration successful! Please login.'); // Reuse toast for success
        switchView('login');
    });

    // Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const data = await api.call('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        user = data;
        if (user.role === 'admin') handleViewAdminDashboard();
        else handleViewMyComplaints();
    });

    // Complaint Flow
    document.getElementById('get-ai-btn')?.addEventListener('click', async () => {
        const text = document.getElementById('complaint-text').value;
        if (!text) return showError('Please describe your complaint');

        const btn = document.getElementById('get-ai-btn');
        btn.disabled = true;
        btn.textContent = 'Generating...';

        try {
            const data = await api.call('/ai/question', {
                method: 'POST',
                body: JSON.stringify({ complaint_text: text })
            });
            document.getElementById('ai-question-text').textContent = data.question;
            document.getElementById('step-1').classList.add('hidden');
            document.getElementById('step-2').classList.remove('hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Get Follow-up Question';
        }
    });

    document.getElementById('final-submit-btn')?.addEventListener('click', async () => {
        const complaint_text = document.getElementById('complaint-text').value;
        const ai_question = document.getElementById('ai-question-text').textContent;
        const ai_answer = document.getElementById('ai-answer-text').value;

        await api.call('/complaints', {
            method: 'POST',
            body: JSON.stringify({ complaint_text, ai_question, ai_answer })
        });

        handleViewMyComplaints();
    });
}

// Global reg state to handle the multi-step form without complex state management
let regState = { email: '', otp: '' };

// Override switchView to capture reg state
const originalSwitchView = switchView;
switchView = (viewName, data = null) => {
    if (viewName === 'otp') regState.email = data.email;
    if (viewName === 'passwordSetup') regState.otp = data.otp;
    originalSwitchView(viewName, data);
};

// Start app
handleCheckSession();
