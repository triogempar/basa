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

// Preferred Model Hierarchy (Primary -> Lite -> Backup)
const MODELS_FALLBACK_LIST = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash'
];

async function generateWithFallback(ai, params) {
  let lastError = null;
  for (const modelName of MODELS_FALLBACK_LIST) {
    try {
      console.log(`[Basa AI] Attempting generation with model: ${modelName}`);
      const response = await ai.models.generateContent({
        ...params,
        model: modelName
      });
      return { response, modelUsed: modelName };
    } catch (err) {
      console.warn(`[Basa AI] Model ${modelName} failed or unavailable:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error('All configured Gemini models failed.');
}

// Endpoint 1: Start Session
app.post('/api/start-session', (req, res) => {
  const { avatarKey } = req.body;
  const avatar = AVATARS[avatarKey] || AVATARS.atma;

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
    const avatar = AVATARS[avatarKey] || AVATARS.atma;

    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required.' });
    }

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
      console.error('Failed to parse Gemini response as JSON:', responseText);
      return res.status(500).json({
        error: 'Invalid JSON format received from AI model.',
        raw: responseText
      });
    }

    res.json({ result: parsedResult, modelUsed });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred while communicating with Gemini API.'
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


