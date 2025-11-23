// ==========================================
// 1. FIREBASE CONFIGURATION (The Brain)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, increment, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// YOUR KEYS
const firebaseConfig = {
  apiKey: "AIzaSyDXLi4eJMGq6E6yqLuGwBfhsp6kBC2Ui2g",
  authDomain: "ai-homework-helper-e54a8.firebaseapp.com",
  projectId: "ai-homework-helper-e54a8",
  storageBucket: "ai-homework-helper-e54a8.firebasestorage.app",
  messagingSenderId: "959104971916",
  appId: "1:959104971916:web:b3fdd1365bdc6c86faf7a9"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Database Connection
const provider = new GoogleAuthProvider();

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const chatHistory = document.getElementById('chat-history');
const form = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const imageInput = document.getElementById('image-upload');
const uploadLabel = document.getElementById('upload-label');
const filePreviewArea = document.getElementById('file-preview-area');
const submitBtn = document.getElementById('submit-btn');

// Sidebar
const historyList = document.getElementById('history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const overlay = document.getElementById('overlay');

// Login & Profile
const loginModal = document.getElementById('loginModal');
const googleLoginBtn = document.getElementById('google-login-btn');
const closeLoginBtn = document.getElementById('close-login-btn');
const loginSidebarBtn = document.getElementById('login-sidebar-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const userNameDisplay = document.getElementById('user-name-display');
const chatCounterDisplay = document.getElementById('chat-counter');

// State Management
let currentUser = null;
let sessions = [];
let currentSessionId = null;
let freeChatCount = parseInt(localStorage.getItem('freeChatCount') || '0');
const MAX_FREE_CHATS = 10; 

// ==========================================
// 3. AUTHENTICATION & DATABASE TRACKING
// ==========================================
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // --- LOGGED IN ---
        console.log("User:", user.displayName);
        
        // 1. SAVE/UPDATE USER STATS IN DATABASE
        const userRef = doc(db, "users", user.uid);
        
        try {
            const docSnap = await getDoc(userRef);
            
            if (!docSnap.exists()) {
                // First time user! Create Profile.
                await setDoc(userRef, {
                    name: user.displayName,
                    email: user.email,
                    photo: user.photoURL,
                    accountCreated: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    loginCount: 1,
                    totalChats: 0,
                    status: "active"
                });
            } else {
                // Returning user! Update Stats.
                await updateDoc(userRef, {
                    lastLogin: serverTimestamp(),
                    loginCount: increment(1),
                    photo: user.photoURL // Update photo if changed
                });
            }
        } catch (e) {
            console.error("DB Error:", e);
        }

        // 2. UI Updates (Avatar Fallback)
        const photoUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=random&color=fff&bold=true`;
        userAvatar.src = photoUrl;
        userNameDisplay.textContent = user.displayName;
        
        userProfile.style.display = 'flex';
        loginSidebarBtn.style.display = 'none';
        logoutBtn.style.display = 'flex';
        
        loginModal.style.display = 'none';
        chatCounterDisplay.textContent = "Plan: Unlimited ♾️";
        
    } else {
        // --- LOGGED OUT ---
        userProfile.style.display = 'none';
        loginSidebarBtn.style.display = 'flex';
        logoutBtn.style.display = 'none';
        
        updateChatCounterUI();
        
        // Limit Check
        if (freeChatCount >= MAX_FREE_CHATS) {
           showLoginModal(true); 
        } else if (freeChatCount === 0) {
           showLoginModal(false); 
        }
    }
});

// Login Button
googleLoginBtn.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (e) { alert("Login failed: " + e.message); }
});

logoutBtn.addEventListener('click', () => signOut(auth));
loginSidebarBtn.addEventListener('click', () => showLoginModal(false));

closeLoginBtn.addEventListener('click', () => {
    if (freeChatCount < MAX_FREE_CHATS) loginModal.style.display = 'none';
});

function showLoginModal(forceStayOpen) {
    loginModal.style.display = 'flex';
    closeLoginBtn.style.display = forceStayOpen ? 'none' : 'block';
}

function updateChatCounterUI() {
    if (!currentUser) {
        const remaining = MAX_FREE_CHATS - freeChatCount;
        chatCounterDisplay.textContent = `Free Chats: ${remaining}`;
        localStorage.setItem('freeChatCount', freeChatCount);
    }
}

// ==========================================
// 4. MAIN APP LOGIC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadSessions();
    if (sessions.length === 0) createNewSession();
    else loadChat(sessions[0].id);
    updateChatCounterUI();
    
    // --- NEW: ENTER KEY TO SEND ---
    userInput.addEventListener('keydown', (e) => {
        // If Enter is pressed WITHOUT Shift
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Don't add a new line
            if (!submitBtn.disabled) {
                // Manually fire the submit event
                form.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if(this.value === '') this.style.height = 'auto';
    });

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-btn') && !e.target.closest('.dropdown-menu')) {
            document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));
        }
    });
});

// Sidebar & UI Events
if(menuBtn) menuBtn.addEventListener('click', toggleSidebar);
if(overlay) overlay.addEventListener('click', toggleSidebar);

if(newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        createNewSession();
        if(window.innerWidth <= 768) toggleSidebar();
    });
}

if(clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        if(confirm("Delete all history? This cannot be undone.")) {
            sessions = [];
            saveSessionsToStorage();
            createNewSession();
        }
    });
}

imageInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        uploadLabel.style.color = '#ef4444';
        filePreviewArea.style.display = 'block';
        filePreviewArea.innerHTML = `<div class="preview-badge"><i class="fas fa-image"></i> ${this.files[0].name}</div>`;
    } else {
        resetFileInput();
    }
});

// --- SUBMIT LOGIC ---
form.addEventListener('submit', async function(e) {
    e.preventDefault();

    // 1. GATEKEEPER
    if (!currentUser && freeChatCount >= MAX_FREE_CHATS) {
        showLoginModal(true);
        return;
    }

    const question = userInput.value.trim();
    const imageFile = imageInput.files[0];
    if (!question && !imageFile) return;

    // 2. TRACKING & COUNTERS
    if (!currentUser) {
        // Guest: Track in LocalStorage
        freeChatCount++;
        updateChatCounterUI();
    } else {
        // User: Track in Database
        try {
            const userRef = doc(db, "users", currentUser.uid);
            updateDoc(userRef, {
                totalChats: increment(1),
                lastActive: serverTimestamp()
            });
        } catch(err) { console.error("Tracking Error", err); }
    }

    // Auto-Rename Session
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (currentSession && (currentSession.messages.length === 0 || currentSession.name.startsWith("Doubt"))) {
        if (question) {
            currentSession.name = question.substring(0, 20) + (question.length > 20 ? '...' : '');
            saveSessionsToStorage();
            renderSidebar();
        }
    }

    // Show User Message
    const userMsg = { role: 'user', text: question, image: imageFile ? URL.createObjectURL(imageFile) : null };
    appendMessageUI(userMsg);
    saveMessage(userMsg);

    // Reset UI
    userInput.value = '';
    userInput.style.height = 'auto';
    resetFileInput();
    submitBtn.disabled = true;
    const loadingId = appendLoadingIndicator();

    // Prepare Data
    const formData = new FormData();
    formData.append('question', question);
    if (imageFile) formData.append('image', imageFile);
    
    // History
    const conversationHistory = currentSession.messages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        text: msg.text
    }));
    formData.append('history', JSON.stringify(conversationHistory));

    try {
        const response = await fetch('/ask', { method: 'POST', body: formData });
        const data = await response.json();
        removeLoadingIndicator(loadingId);

        const aiText = data.success ? data.answer : "⚠️ Error: " + (data.error || "Unknown");
        const aiMsg = { role: 'ai', text: aiText };
        
        appendMessageUI(aiMsg);
        saveMessage(aiMsg);

    } catch (error) {
        console.error("Fetch error:", error);
        removeLoadingIndicator(loadingId);
        appendMessageUI({ role: 'ai', text: "❌ Connection Error. Is your server running?" });
    } finally {
        submitBtn.disabled = false;
        userInput.focus();
    }
});

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================

function loadSessions() {
    try {
        const stored = localStorage.getItem('ai_tutor_sessions');
        if (stored) sessions = JSON.parse(stored);
    } catch(e) { sessions = []; }
}

function saveSessionsToStorage() {
    const safeSessions = sessions.map(s => ({
        ...s,
        messages: s.messages.map(m => ({ ...m, image: null })) 
    }));
    localStorage.setItem('ai_tutor_sessions', JSON.stringify(safeSessions));
}

function createNewSession() {
    const newId = Date.now().toString();
    const newSession = { id: newId, name: `Doubt ${sessions.length + 1}`, messages: [] };
    sessions.unshift(newSession);
    currentSessionId = newId;
    saveSessionsToStorage();
    chatHistory.innerHTML = '';
    renderSidebar();
    appendMessageUI({ role: 'ai', text: "👋 New chat started! How can I help?" });
}

function loadChat(sessionId) {
    currentSessionId = sessionId;
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    chatHistory.innerHTML = '';
    if (session.messages.length === 0) {
        appendMessageUI({ role: 'ai', text: "👋 Ask me anything!" });
    } else {
        session.messages.forEach(msg => appendMessageUI(msg));
    }
    renderSidebar();
    if(window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

function saveMessage(msg) {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
        session.messages.push(msg);
        saveSessionsToStorage();
    }
}

window.renameSession = function(id) {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const newName = prompt("Enter new name:", session.name);
    if (newName && newName.trim() !== "") {
        session.name = newName.trim();
        saveSessionsToStorage();
        renderSidebar();
    }
};

window.deleteSession = function(id) {
    if(!confirm("Delete this chat?")) return;
    sessions = sessions.filter(s => s.id !== id);
    saveSessionsToStorage();
    if (sessions.length === 0) createNewSession();
    else if (id === currentSessionId) loadChat(sessions[0].id);
    else renderSidebar();
};

window.toggleMenu = function(event, id) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));
    const menu = document.getElementById(`menu-${id}`);
    if (menu) {
        menu.classList.toggle('show');
        event.currentTarget.classList.toggle('active');
    }
};

function renderSidebar() {
    historyList.innerHTML = '';
    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
        
        div.onclick = (e) => {
            if (!e.target.closest('.menu-btn') && !e.target.closest('.dropdown-menu')) {
                loadChat(session.id);
            }
        };

        div.innerHTML = `
            <span class="chat-title"><i class="far fa-comment-alt"></i> ${session.name}</span>
            <button class="menu-btn" onclick="toggleMenu(event, '${session.id}')"><i class="fas fa-ellipsis-v"></i></button>
            <div id="menu-${session.id}" class="dropdown-menu">
                <div class="dropdown-item" onclick="renameSession('${session.id}')"><i class="fas fa-edit"></i> Rename</div>
                <div class="dropdown-item delete" onclick="deleteSession('${session.id}')"><i class="fas fa-trash-alt"></i> Delete</div>
            </div>
        `;
        historyList.appendChild(div);
    });
}

function toggleSidebar() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

function appendMessageUI(msg) {
    const div = document.createElement('div');
    div.className = `message-row ${msg.role}`;
    let contentHtml = '';
    if (msg.image) contentHtml += `<img src="${msg.image}" class="chat-img-preview">`;
    
    let textHtml = msg.text || '';
    if (typeof marked !== 'undefined' && msg.text) textHtml = marked.parse(msg.text);
    
    if (textHtml) contentHtml += `<div class="bubble-content">${textHtml}</div>`;
    div.innerHTML = `<div class="bubble">${contentHtml}</div>`;
    chatHistory.appendChild(div);
    
    if (typeof renderMathInElement !== 'undefined') {
        try {
            renderMathInElement(div, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\(", right: "\\)", display: false},
                    {left: "\\[", right: "\\]", display: true}
                ],
                throwOnError: false
            });
        } catch (e) { console.error("Math error", e); }
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendLoadingIndicator() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message-row ai';
    div.id = id;
    div.innerHTML = `<div class="bubble"><div class="typing-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return id;
}

function removeLoadingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function resetFileInput() {
    imageInput.value = '';
    uploadLabel.style.color = '#64748b';
    filePreviewArea.style.display = 'none';
}

// ==========================================
// 6. FEEDBACK FEATURE (EXISTING CODE)
// ==========================================

// Initialize EmailJS
(function() {
    if(typeof emailjs !== 'undefined') emailjs.init("recIfuDbj4eX1CCZ1");
})();

const feedbackBtn = document.getElementById('feedback-btn');
const feedbackModal = document.getElementById('feedbackModal');
const feedbackCloseButtons = document.querySelectorAll('.close-modal'); 
const feedbackForm = document.getElementById('feedbackForm');
const feedbackStatus = document.getElementById('feedback-status');

if (feedbackBtn) feedbackBtn.addEventListener('click', () => feedbackModal.style.display = 'block');

feedbackCloseButtons.forEach(btn => {
    btn.addEventListener('click', function() {
        if(this.closest('#feedbackModal')) {
             feedbackModal.style.display = 'none';
             if(feedbackForm) feedbackForm.reset();
             if(feedbackStatus) feedbackStatus.style.display = 'none';
        }
    });
});

window.addEventListener('click', (e) => {
    if (e.target === feedbackModal) {
        feedbackModal.style.display = 'none';
        if(feedbackForm) feedbackForm.reset();
        if(feedbackStatus) feedbackStatus.style.display = 'none';
    }
});

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = feedbackForm.querySelector('.submit-feedback-btn');
        const userName = document.getElementById('user-name').value;
        const userEmail = document.getElementById('user-email').value;
        const message = document.getElementById('feedback-message').value;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        feedbackStatus.style.display = 'none';
        
        const templateParams = {
            from_name: userName,
            from_email: userEmail,
            message: message,
            to_name: 'Admin'
        };
        
        try {
            await emailjs.send('service_0uss1m2', 'template_1815img', templateParams);
            feedbackStatus.className = 'feedback-status success';
            feedbackStatus.textContent = '✅ Feedback sent successfully! Thank you!';
            feedbackStatus.style.display = 'block';
            feedbackForm.reset();
            setTimeout(() => {
                feedbackModal.style.display = 'none';
                feedbackStatus.style.display = 'none';
            }, 2000);
        } catch (error) {
            console.error('FAILED...', error);
            feedbackStatus.className = 'feedback-status error';
            feedbackStatus.textContent = '❌ Failed to send. Please try again.';
            feedbackStatus.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Feedback';
        }
    });
}