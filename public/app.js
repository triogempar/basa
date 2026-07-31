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
  isThinking: false,
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
const personaName = document.getElementById('personaName');
const personaTagline = document.getElementById('personaTagline');
const ttsToggle = document.getElementById('ttsToggle');
const chatContainer = document.getElementById('chatContainer');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const dismissError = document.getElementById('dismissError');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  // Auto-start session for default avatar (Raya)
  switchAvatar('raya');
});

// Setup DOM Event Listeners
function setupEventListeners() {
  // Avatar Tab Switches
  tabAtma.addEventListener('click', () => switchAvatar('atma'));
  tabRaya.addEventListener('click', () => switchAvatar('raya'));

  // TTS Toggle Switch
  ttsToggle.addEventListener('change', (e) => {
    state.autoTTS = e.target.checked;
  });

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

// Switch Active Avatar Tab & Load History
async function switchAvatar(avatarKey) {
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

  // Update Persona Header Details
  personaName.textContent = meta.name;
  personaTagline.textContent = meta.tagline;

  // Render Saved History for this avatar
  renderChatHistory();

  // If no history exists yet for this avatar, trigger start-session API
  if (state.histories[avatarKey].length === 0) {
    await startAvatarSession(avatarKey);
  }
}

// Trigger initial greeting from backend for selected avatar
async function startAvatarSession(avatarKey) {
  showTyping(true, `${AVATAR_META[avatarKey].name} is connecting...`);

  try {
    const res = await fetch('/api/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarKey })
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
  const text = userInput.value.trim();
  if (!text || state.isThinking) return;

  const avatarKey = state.currentAvatar;

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
        conversation: conversationPayload
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
  const history = state.histories[state.currentAvatar];
  const meta = AVATAR_META[state.currentAvatar];

  history.forEach(item => {
    if (item.role === 'user') {
      renderUserMessage(item.text);
    } else {
      renderModelMessage(item.rawData || parseRawModelText(item.text), meta);
    }
  });

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
            ⚡ Catatan Tata Bahasa & Kosakata
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
            <button class="action-icon-btn copy-btn" title="Copy text">📋</button>
            <button class="action-icon-btn speak-btn" title="Read aloud">🔊</button>
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
    copyBtn.textContent = '✓';
    setTimeout(() => copyBtn.textContent = '📋', 1500);
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
