import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Avatar Personas Configuration
const AVATARS = {
  atma: {
    name: 'Atma',
    role: 'HR Interviewer',
    tagline: 'Formal Job Interview',
    greeting: "Good day. Thank you for joining this interview. To start, could you please introduce yourself and tell me about your professional background?",
    systemInstruction: `You are Atma, a professional HR Interviewer conducting a job interview in English. 
Evaluate the user's English input carefully. If there are grammar, syntax, phrasing, or vocabulary mistakes, provide corrections with explanations written in clear Indonesian. Keep your conversational reply in formal, professional English as an HR interviewer. 
Output MUST be valid JSON matching the specified schema.
If the user's input has no grammar/vocabulary errors, set hasCorrection to false and correction to null.`
  },
  raya: {
    name: 'Raya',
    role: 'Friendly Companion',
    tagline: 'Casual Daily Chat',
    greeting: "Hey there! How's your day going? What are you up to today?",
    systemInstruction: `You are Raya, a friendly and casual friend chatting in natural English. 
Evaluate the user's English input carefully. If there are grammar or vocabulary mistakes, provide corrections with explanations written in simple, friendly Indonesian. Keep your conversational reply in casual, warm English (standard slang is fine). 
Output MUST be valid JSON matching the specified schema.
If the user's input has no grammar/vocabulary errors, set hasCorrection to false and correction to null.`
  }
};

// Response JSON Schema definition for Gemini
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Conversational reply from the avatar in English'
    },
    hasCorrection: {
      type: Type.BOOLEAN,
      description: 'True if user input has grammar/vocabulary errors, false otherwise'
    },
    correction: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        originalText: {
          type: Type.STRING,
          description: "User's original text with mistakes"
        },
        correctedText: {
          type: Type.STRING,
          description: 'Grammatically correct version'
        },
        explanation: {
          type: Type.STRING,
          description: 'Brief explanation of the error/improvement in Indonesian'
        }
      },
      required: ['originalText', 'correctedText', 'explanation']
    }
  },
  required: ['reply', 'hasCorrection', 'correction']
};

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is missing or invalid in environment variables.');
  }
  return new GoogleGenAI({ apiKey });
};

// ANSI Terminal Colors & Logger Utility
const getTimestamp = () => new Date().toLocaleTimeString('en-GB');

const log = {
  info: (msg) => console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[36mℹ️ [Basa AI]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[32m✅ [Basa AI]\x1b[0m ${msg}`),
  warn: (model, reason) => console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[33m⚠️ [Fallback]\x1b[0m Model \x1b[1m${model}\x1b[0m gagal ➔ \x1b[33m${reason}\x1b[0m`),
  error: (msg) => console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[31m❌ [Chat API Error]\x1b[0m ${msg}`)
};

// Helper to extract a clean 1-line summary from raw API errors
function parseCleanErrorMessage(err) {
  if (!err) return 'Unknown error';
  const rawMsg = err.message || JSON.stringify(err);
  if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
    return '503 Unavailable (High Demand / Server Overloaded)';
  }
  if (rawMsg.includes('404') || rawMsg.includes('not found')) {
    return '404 Model Not Found';
  }
  if (rawMsg.includes('400') || rawMsg.includes('invalid argument')) {
    return '400 Invalid Model or Parameters';
  }
  if (rawMsg.includes('GEMINI_API_KEY')) {
    return 'Missing or invalid GEMINI_API_KEY';
  }
  if (rawMsg.includes('timed out')) {
    return 'Timeout (>6s without response)';
  }
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed.error && parsed.error.message) {
      return `${parsed.error.code || ''} ${parsed.error.message}`.substring(0, 100);
    }
  } catch (e) {}
  return rawMsg.replace(/[\r\n]+/g, ' ').substring(0, 120);
}

// Preferred Model Hierarchy (Primary -> Lite -> Backup -> Stable Defaults)
const MODELS_FALLBACK_LIST = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash'
];

// Helper to enforce a strict timeout per API call attempt so it never hangs indefinitely
function generateWithTimeout(ai, params, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    let completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        completed = true;
        reject(new Error(`Model attempt '${params.model}' timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    ai.models.generateContent(params)
      .then(res => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(err => {
        if (!completed) {
          completed = true;
          clearTimeout(timer);
          reject(err);
        }
      });
  });
}

async function generateWithFallback(ai, params) {
  let lastError = null;
  for (const modelName of MODELS_FALLBACK_LIST) {
    try {
      log.info(`⏳ Memproses pesan dengan model: \x1b[1m${modelName}\x1b[0m...`);
      const response = await generateWithTimeout(ai, {
        ...params,
        model: modelName
      }, 6000);

      log.success(`Respon berhasil dibuat menggunakan model: \x1b[1m${modelName}\x1b[0m`);
      return { response, modelUsed: modelName };
    } catch (err) {
      const cleanReason = parseCleanErrorMessage(err);
      log.warn(modelName, cleanReason);
      lastError = err;
    }
  }
  throw lastError || new Error('Semua model Gemini yang dikonfigurasi sedang tidak tersedia atau mengalami beban tinggi (Overloaded).');
}

// Endpoint 1: Start Session
app.post('/api/start-session', (req, res) => {
  const { avatarKey } = req.body;
  const avatar = AVATARS[avatarKey] || AVATARS.raya;

  log.info(`▶️ Session baru dimulai untuk Avatar: \x1b[1m${avatar.name}\x1b[0m (${avatar.role})`);

  res.json({
    avatarName: avatar.name,
    role: avatar.role,
    greeting: avatar.greeting
  });
});

// Endpoint 2: Multi-turn Chat & Grammar Evaluation
app.post('/api/chat', async (req, res) => {
  try {
    const { avatarKey, conversation } = req.body;
    const avatar = AVATARS[avatarKey] || AVATARS.raya;

    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required.' });
    }

    log.info(`💬 Pesan diterima dari user untuk Avatar \x1b[1m${avatar.name}\x1b[0m`);

    // Format conversation history for Gemini API: [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
    const formattedContents = conversation.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text) }]
    }));

    const ai = getGeminiClient();

    const { response, modelUsed } = await generateWithFallback(ai, {
      contents: formattedContents,
      config: {
        systemInstruction: avatar.systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      }
    });

    const responseText = response.text;
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch (parseErr) {
      log.error(`Gagal parsing JSON dari model: ${responseText.substring(0, 100)}`);
      return res.status(500).json({
        error: 'Format JSON dari model AI tidak valid.',
        raw: responseText
      });
    }

    res.json({ result: parsedResult, modelUsed });
  } catch (error) {
    const cleanErr = parseCleanErrorMessage(error);
    log.error(`Gagal memproses percakapan: ${cleanErr}`);

    let friendlyMessage = 'Terjadi kesalahan saat berkomunikasi dengan AI.';
    if (error.message && error.message.includes('GEMINI_API_KEY')) {
      friendlyMessage = 'GEMINI_API_KEY belum dikonfigurasi atau tidak valid di file .env.';
    } else if (error.message && (error.message.includes('503') || error.message.includes('high demand') || error.message.includes('Overloaded'))) {
      friendlyMessage = 'Semua model AI sedang mengalami beban tinggi (503 High Demand). Silakan coba lagi beberapa saat lagi.';
    } else if (error.message) {
      friendlyMessage = error.message;
    }

    res.status(500).json({
      error: friendlyMessage
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Basa AI Chatbot Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use by another process.`);
    console.error(`👉 You can specify a different port in .env (e.g. PORT=3001) or stop the existing process.`);
  } else {
    console.error('Server error:', err);
  }
});


