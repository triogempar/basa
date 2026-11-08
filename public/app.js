/**
 * LinguaShift Frontend Application Logic
 * AI English Roleplay Chatbot with Live Grammar Correction
 */

// Application State
const state = {
  currentAvatar: 'raya', // 'raya' | 'atma'
  histories: {
    atma: [],
    raya: []
  },
  topics: {
    atma: [],
    raya: []
  },
  activeScenario: {
    atma: null,
    raya: null
  },
  isThinking: false,
  isLoadingTopics: false,
  autoTTS: true
};

// Avatar Configuration Metadata
const AVATAR_META = {
  atma: {
    name: 'Atma',
    role: 'HR Interviewer',
    tagline: 'Formal Job Interview & Career Coaching',
    icon: '💼',
    voicePitch: 0.9,
    voiceRate: 0.95
  },
  raya: {
    name: 'Raya',
    role: 'Casual Friend',
    tagline: 'Casual Daily Chat & Conversational English',
    icon: '✨',
    voicePitch: 1.1,
    voiceRate: 1.0
  }
};

// DOM Elements
const tabAtma = document.getElementById('tabAtma');
const tabRaya = document.getElementById('tabRaya');
const ttsToggleBtn = document.getElementById('ttsToggleBtn');
const ttsIcon = document.getElementById('ttsIcon');
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const dismissError = document.getElementById('dismissError');
const appContainer = document.getElementById('appContainer');
const loginBtn = document.getElementById('loginBtn');
const gateLoginBtn = document.getElementById('gateLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authUser = document.getElementById('authUser');
const userAvatar = document.getElementById('userAvatar');
const userInitial = document.getElementById('userInitial');
const userName = document.getElementById('userName');
const authGateStatus = document.getElementById('authGateStatus');

function isPracticeUnlocked() {
  return appContainer.classList.contains('is-authenticated');
}

// Initialize App. The roleplay session starts only after Auth0 says we are logged in.
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupAuthGate();
});

// Setup DOM Event Listeners
function setupEventListeners() {
  // Avatar Tab Switches
  tabAtma.addEventListener('click', () => switchAvatar('atma'));
  tabRaya.addEventListener('click', () => switchAvatar('raya'));

  // TTS Icon Button Toggle
  if (ttsToggleBtn) {
    ttsToggleBtn.addEventListener('click', () => {
      state.autoTTS = !state.autoTTS;
      if (ttsToggleBtn) {
        ttsToggleBtn.classList.toggle('active', state.autoTTS);
      }
      if (ttsIcon) {
        ttsIcon.textContent = state.autoTTS ? '🔊' : '🔇';
      }
    });
  }



  // Clear Chat History
  const clearChatBtn = document.getElementById('clearChatBtn');
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', async () => {
      const avatarKey = state.currentAvatar;
      state.histories[avatarKey] = [];
      state.activeScenario[avatarKey] = null;
      renderChatHistory();
      await startAvatarSession(avatarKey);
    });
  }

  // Error Banner Dismiss
  dismissError.addEventListener('click', () => {
    errorBanner.classList.add('hidden');
  });

  // Chat Form Submission
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Textarea Auto-expand & Enter Key Submit
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
  });
}

// Log in / log out controls, then open the chat only for an authenticated user.
function setupAuthGate() {
  const onLogin = async () => {
    setLoginBusy(true);
    setAuthStatus('Redirecting to Auth0…');
    try {
      await window.BasaAuth.login();
    } catch (err) {
      console.error('Login error:', err);
      setLoginBusy(false);
      setAuthStatus(err.message || 'Could not start login.', true);
    }
  };

  loginBtn.addEventListener('click', onLogin);
  gateLoginBtn.addEventListener('click', onLogin);
  logoutBtn.addEventListener('click', () => window.BasaAuth.logout());
  userAvatar.addEventListener('error', () => {
    userAvatar.classList.add('hidden');
    userInitial.classList.remove('hidden');
  });

  startAuth();
}

async function startAuth() {
  try {
    const session = await window.BasaAuth.initAuth();
    if (session.isAuthenticated) {
      showAuthenticated(session.user);
      await switchAvatar('raya');
      return;
    }
    showGuest('Sign in to start your session.');
  } catch (err) {
    console.error('Auth0 init error:', err);
    showGuest(err.message || 'Auth0 login is unavailable.', {
      canLogin: window.BasaAuth.isReady(),
      isError: true
    });
  }
}

function showAuthenticated(user) {
  appContainer.classList.remove('is-guest');
  appContainer.classList.add('is-authenticated');

  const name = (user && (user.name || user.nickname || user.email)) || 'Signed in';
  userName.textContent = name;
  userName.title = name;
  userInitial.textContent = name.trim().charAt(0).toUpperCase() || 'B';
  authUser.classList.remove('hidden');

  if (user && user.picture && isSafeImageUrl(user.picture)) {
    userAvatar.alt = name;
    userAvatar.classList.remove('hidden');
    userInitial.classList.add('hidden');
    userAvatar.src = user.picture;
  } else {
    userAvatar.removeAttribute('src');
    userAvatar.alt = '';
    userAvatar.classList.add('hidden');
    userInitial.classList.remove('hidden');
  }
}

function showGuest(message, { canLogin = true, isError = false } = {}) {
  appContainer.classList.add('is-guest');
  appContainer.classList.remove('is-authenticated');
  authUser.classList.add('hidden');
  setLoginBusy(!canLogin);
  setAuthStatus(message || '', isError);
}

function isSafeImageUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (err) {
    return false;
  }
}

function setLoginBusy(isBusy) {
  loginBtn.disabled = isBusy;
  gateLoginBtn.disabled = isBusy;
}

function setAuthStatus(message, isError) {
  authGateStatus.textContent = message || '';
  authGateStatus.classList.toggle('is-error', Boolean(isError));
}

// Switch Active Avatar Tab & Load History & Load Topics
async function switchAvatar(avatarKey) {
  if (!isPracticeUnlocked()) return;
  if (state.isThinking) return; // Prevent tab switch during active API request

  state.currentAvatar = avatarKey;
  const meta = AVATAR_META[avatarKey];

  // Update Active Tab UI
  if (avatarKey === 'atma') {
    tabAtma.classList.add('active');
    tabRaya.classList.remove('active');
    document.documentElement.style.setProperty('--active-accent', 'var(--atma-primary)');
    document.documentElement.style.setProperty('--active-glow', 'var(--atma-glow)');
    document.documentElement.style.setProperty('--active-gradient', 'var(--atma-gradient)');
  } else {
    tabRaya.classList.add('active');
    tabAtma.classList.remove('active');
    document.documentElement.style.setProperty('--active-accent', 'var(--raya-primary)');
    document.documentElement.style.setProperty('--active-glow', 'var(--raya-glow)');
    document.documentElement.style.setProperty('--active-gradient', 'var(--raya-gradient)');
  }

  // Update Persona Header Details if present
  const personaName = document.getElementById('personaName');
  const personaTagline = document.getElementById('personaTagline');
  if (personaName) personaName.textContent = meta.name;
  if (personaTagline) personaTagline.textContent = meta.tagline;

  // Render Saved History & Topics for this avatar
  renderChatHistory();

  // Load AI topics if not loaded yet
  if (!state.topics[avatarKey] || state.topics[avatarKey].length === 0) {
    fetchAITopics(avatarKey);
  }

  // If no history exists yet for this avatar, trigger start-session API
  if (state.histories[avatarKey].length === 0) {
    await startAvatarSession(avatarKey);
  }
}


// Fetch 3 AI-generated Roleplay Scenarios from Gemini Backend
async function fetchAITopics(avatarKey) {
  if (!isPracticeUnlocked()) return;
  if (state.isLoadingTopics) return;
  state.isLoadingTopics = true;

  renderChatHistory();

  try {
    const res = await fetch('/api/generate-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarKey })
    });

    if (!res.ok) {
      throw new Error(`Failed to generate AI topics (Status ${res.status})`);
    }

    const data = await res.json();
    state.topics[avatarKey] = data.topics || [];
  } catch (err) {
    console.error('Fetch topics error:', err);
  } finally {
    state.isLoadingTopics = false;
    renderChatHistory();
  }
}

// Render Starter Scenario Prompt Cards directly inside the Chat Window (Empty State)
function renderStarterScenariosWidget(avatarKey) {
  const container = document.createElement('div');
  container.className = 'starter-scenarios-container';

  const topics = state.topics[avatarKey] || [];
  const isLoading = state.isLoadingTopics;

  let cardsHtml = '';
  if (isLoading) {
    cardsHtml = `
      <div class="starter-skeleton"></div>
      <div class="starter-skeleton"></div>
      <div class="starter-skeleton"></div>
    `;
  } else if (topics.length > 0) {
    cardsHtml = topics.map(t => {
      const isActive = state.activeScenario[avatarKey] && state.activeScenario[avatarKey].id === t.id;
      return `
        <button class="starter-card ${isActive ? 'active' : ''}" data-topic-id="${escapeHtml(t.id)}">
          <div class="starter-card-top">
            <span class="starter-icon">${escapeHtml(t.icon || '💬')}</span>
            <span class="starter-tag">${escapeHtml(t.tag || 'Roleplay')}</span>
          </div>
          <div class="starter-card-title">${escapeHtml(t.title)}</div>
          <div class="starter-card-desc">${escapeHtml(t.description)}</div>
        </button>
      `;
    }).join('');
  } else {
    cardsHtml = `<div class="starter-empty">Tap Shuffle to generate fresh AI scenarios.</div>`;
  }

  container.innerHTML = `
    <div class="starter-header">
      <div class="starter-title">
        <span class="sparkle-icon">✨</span>
        <span>Choose a Practice Scenario (Generated by AI)</span>
      </div>
      <button class="starter-shuffle-btn" id="shuffleStarterBtn" title="Generate New AI Scenarios">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>Shuffle Topics</span>
      </button>
    </div>
    <div class="starter-grid">
      ${cardsHtml}
    </div>
  `;

  // Bind scenario card click events
  const cardBtns = container.querySelectorAll('.starter-card');
  cardBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const topicId = btn.getAttribute('data-topic-id');
      const selectedTopic = topics.find(t => t.id === topicId);
      if (selectedTopic && !state.isThinking) {
        state.activeScenario[avatarKey] = selectedTopic;
        state.histories[avatarKey] = [];
        renderChatHistory();
        await startAvatarSession(avatarKey, selectedTopic);
      }
    });
  });

  // Bind shuffle topics button
  const shuffleBtn = container.querySelector('#shuffleStarterBtn');
  if (shuffleBtn) {
    if (state.isLoadingTopics) shuffleBtn.classList.add('spinning');
    shuffleBtn.addEventListener('click', () => {
      fetchAITopics(state.currentAvatar);
    });
  }

  chatContainer.appendChild(container);
}



// Trigger initial greeting from backend for selected avatar
async function startAvatarSession(avatarKey, overrideScenario = null) {
  if (!isPracticeUnlocked()) return;
  showTyping(true, `${AVATAR_META[avatarKey].name} is connecting...`);

  const activeScenario = overrideScenario || state.activeScenario[avatarKey];

  try {
    const res = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarKey, scenario: activeScenario })
    });

    if (!res.ok) {
      throw new Error(`Failed to initialize avatar session (Status ${res.status})`);
    }

    const data = await res.json();
    const greetingText = data.greeting;

    // Add model greeting to history
    const modelEntry = {
      role: 'model',
      text: greetingText,
      rawData: {
        reply: greetingText,
        hasCorrection: false,
        correction: null
      }
    };

    state.histories[avatarKey].push(modelEntry);
    renderChatHistory();

    if (state.autoTTS) {
      speakText(greetingText, avatarKey);
    }
  } catch (err) {
    showError(err.message || 'Error starting avatar session.');
  } finally {
    showTyping(false);
  }
}

// Send user message and fetch AI reply & grammar evaluation
async function handleSendMessage() {
  if (!isPracticeUnlocked()) return;
  const text = userInput.value.trim();
  if (!text || state.isThinking) return;

  const avatarKey = state.currentAvatar;
  const activeScenario = state.activeScenario[avatarKey];

  // Add user message to history
  const userEntry = { role: 'user', text: text };
  state.histories[avatarKey].push(userEntry);

  // Clear input
  userInput.value = '';
  userInput.style.height = 'auto';

  // Render updated chat
  renderChatHistory();

  // Prepare payload for backend API
  // Map conversation history to expected API format
  const conversationPayload = state.histories[avatarKey].map(msg => ({
    role: msg.role,
    text: msg.text
  }));

  showTyping(true, `${AVATAR_META[avatarKey].name} is evaluating your reply...`);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarKey,
        conversation: conversationPayload,
        scenario: activeScenario
      })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to get response from Gemini API.');
    }

    const aiResult = data.result; // { reply, hasCorrection, correction }

    // Store AI response into history
    const modelEntry = {
      role: 'model',
      text: JSON.stringify(aiResult),
      rawData: aiResult
    };

    state.histories[avatarKey].push(modelEntry);
    renderChatHistory();

    // Trigger TTS if enabled
    if (state.autoTTS && aiResult.reply) {
      speakText(aiResult.reply, avatarKey);
    }
  } catch (err) {
    console.error('Chat error:', err);
    showError(err.message || 'Something went wrong while chatting with AI.');
  } finally {
    showTyping(false);
  }
}

// Render Chat History for Active Avatar
function renderChatHistory() {
  chatContainer.innerHTML = '';
  const avatarKey = state.currentAvatar;
  const history = state.histories[avatarKey];
  const meta = AVATAR_META[avatarKey];

  history.forEach(item => {
    if (item.role === 'user') {
      renderUserMessage(item.text);
    } else {
      renderModelMessage(item.rawData || parseRawModelText(item.text), meta);
    }
  });

  // Show AI scenario prompt chips ONLY when session is empty & no scenario has been selected yet
  const hasUserReplied = history.some(m => m.role === 'user');
  const hasChosenScenario = state.activeScenario[avatarKey] !== null;
  if (!hasUserReplied && !hasChosenScenario) {
    renderStarterScenariosWidget(avatarKey);
  }

  scrollToBottom();
}



// Helper to safely extract reply object if stored as string
function parseRawModelText(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return { reply: text, hasCorrection: false, correction: null };
  }
}

// Render User Message Bubble
function renderUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'message-row user';

  row.innerHTML = `
    <div class="avatar-bubble">👤</div>
    <div class="message-content-group">
      <div class="message-bubble">${escapeHtml(text)}</div>
      <div class="message-meta">
        <span>You</span>
      </div>
    </div>
  `;

  chatContainer.appendChild(row);
}

// Render Model Message Bubble with Grammar Correction Card (if applicable)
function renderModelMessage(data, meta) {
  const row = document.createElement('div');
  row.className = 'message-row model';
  row.setAttribute('data-avatar', state.currentAvatar);

  const replyText = data.reply || 'No response text available.';
  const hasCorrection = data.hasCorrection && data.correction;

  let correctionHtml = '';
  if (hasCorrection) {
    const c = data.correction;
    correctionHtml = `
      <div class="grammar-card">
        <div class="grammar-header">
          <span class="grammar-badge">
            ⚡ Grammar & Phrasing Insight
          </span>
        </div>
        <div class="grammar-body">
          <div class="diff-line">
            <span class="diff-label">Original:</span>
            <span class="original-text">${escapeHtml(c.originalText || '')}</span>
          </div>
          <div class="diff-line">
            <span class="diff-label">Better:</span>
            <span class="corrected-text">${escapeHtml(c.correctedText || '')}</span>
          </div>
          <div class="explanation-text">
            💡 <strong>Tips:</strong> ${escapeHtml(c.explanation || '')}
          </div>
        </div>
      </div>
    `;
  }

  row.innerHTML = `
    <div class="avatar-bubble">${meta.icon}</div>
    <div class="message-content-group">
      <div class="message-bubble">
        ${escapeHtml(replyText)}
        <div class="message-meta">
          <span>${meta.name} • ${meta.role}</span>
          <div class="message-actions">
            <button class="action-icon-btn copy-btn" title="Copy text">📋 Copy</button>
            <button class="action-icon-btn speak-btn" title="Read aloud">🔊 Listen</button>
          </div>
        </div>
      </div>
      ${correctionHtml}
    </div>
  `;

  // Add button action listeners
  const copyBtn = row.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(replyText);
    copyBtn.textContent = '✓ Copied';
    setTimeout(() => copyBtn.textContent = '📋 Copy', 1800);
  });

  const speakBtn = row.querySelector('.speak-btn');
  speakBtn.addEventListener('click', () => {
    speakText(replyText, state.currentAvatar);
  });

  chatContainer.appendChild(row);
}

// Text-to-Speech Helper using Web Speech API
function speakText(text, avatarKey) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Stop any ongoing speech
  const utterance = new SpeechSynthesisUtterance(text);
  const meta = AVATAR_META[avatarKey];

  utterance.lang = 'en-US';
  utterance.pitch = meta.voicePitch;
  utterance.rate = meta.voiceRate;

  // Try to pick a natural English voice if available
  const voices = window.speechSynthesis.getVoices();
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  if (enVoices.length > 0) {
    // Pick different voices for Atma (formal/male/standard) vs Raya (casual/female)
    if (avatarKey === 'raya' && enVoices.length > 1) {
      utterance.voice = enVoices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('zira')) || enVoices[0];
    } else {
      utterance.voice = enVoices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('alex')) || enVoices[0];
    }
  }

  window.speechSynthesis.speak(utterance);
}

// UI Utilities
function showTyping(show, text = 'Thinking...') {
  state.isThinking = show;
  if (show) {
    typingText.textContent = text;
    typingIndicator.classList.remove('hidden');
    sendBtn.disabled = true;
  } else {
    typingIndicator.classList.add('hidden');
    sendBtn.disabled = false;
  }
  scrollToBottom();
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');

  // Render a system alert message bubble directly inside the chat window
  const systemRow = document.createElement('div');
  systemRow.className = 'message-row model';
  systemRow.innerHTML = `
    <div class="avatar-bubble" style="background: rgba(239, 68, 68, 0.2); border-color: rgba(239, 68, 68, 0.5);">⚠️</div>
    <div class="message-content-group">
      <div class="message-bubble" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5;">
        ${escapeHtml(msg)}
      </div>
    </div>
  `;
  chatContainer.appendChild(systemRow);
  scrollToBottom();
}

function scrollToBottom() {
  setTimeout(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, 50);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
