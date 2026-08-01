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

import fs from 'fs';

// Helper to load prompt files safely
const loadPrompt = (filename) => {
  const filePath = path.join(__dirname, 'prompts', filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Failed to load prompt file ${filename}:`, err.message);
    return '';
  }
};

// Avatar Personas Configuration
const AVATARS = {
  atma: {
    name: 'Atma',
    role: 'HR Interviewer',
    tagline: 'Formal Job Interview',
    greeting: "Good day. Thank you for joining this interview. To start, could you please introduce yourself and tell me about your professional background?",
    systemInstruction: loadPrompt('atma.txt')
  },
  raya: {
    name: 'Raya',
    role: 'Friendly Companion',
    tagline: 'Casual Daily Chat',
    greeting: "Hey there! How's your day going? What are you up to today?",
    systemInstruction: loadPrompt('raya.txt')
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

// Topic Generator JSON Schema definition for Gemini
const topicSchema = {
  type: Type.OBJECT,
  properties: {
    topics: {
      type: Type.ARRAY,
      description: 'List of 3 distinct practice roleplay scenarios',
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          icon: { type: Type.STRING, description: 'One relevant emoji icon' },
          title: { type: Type.STRING, description: 'Short catchy scenario title in English' },
          tag: { type: Type.STRING, description: 'Short category tag like Casual • Beginner or Formal • Behavioral' },
          description: { type: Type.STRING, description: 'Scenario context description in Indonesian (Bahasa Indonesia)' },
          starterGreeting: { type: Type.STRING, description: 'Opening message in English from avatar to start this roleplay scenario' }
        },
        required: ['id', 'icon', 'title', 'tag', 'description', 'starterGreeting']
      }
    }
  },
  required: ['topics']
};


// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing or invalid in environment variables.');
  }
  return new GoogleGenAI({ apiKey });
};

// Preferred Model Hierarchy (Primary -> Lite -> Backup -> Stable Defaults)
const MODELS_FALLBACK_LIST = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite'
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
      console.log(`[Basa AI] ⏳ Trying model: ${modelName}...`);
      const response = await generateWithTimeout(ai, {
        ...params,
        model: modelName
      }, 6000);

      console.log(`[Basa AI] ✅ Successfully generated response using model: ${modelName}`);
      return { response, modelUsed: modelName };
    } catch (err) {
      const errMsg = err.message || JSON.stringify(err);
      console.warn(`[Basa AI] ⚠️ Model '${modelName}' failed/unavailable: ${errMsg}`);
      lastError = err;
    }
  }
  throw lastError || new Error('Semua model Gemini yang dikonfigurasi sedang tidak tersedia atau mengalami beban tinggi (Overloaded).');
}

// Helper array shuffle for maximum topic randomness
function getRandomThemes(avatarKey) {
  const rayaThemes = [
    'Baking & Cooking Disasters', 'Tech & Smartphone Debates', 'Planning a Surprise Party',
    'Gym & Fitness Motivation', 'Weekend Road Trip', 'Adopting a Pet Dog/Cat',
    'Camping & Wilderness Mishaps', 'Concert & Music Festival Stories', 'Street Food & Night Markets',
    'Book & Movie Recommendations', 'DIY Home Decor & Renovation', 'Thrift Shopping & Fashion',
    'Stuck in Heavy Traffic', 'Coffee Shop Latte Art', 'Gaming & Esports Tournaments'
  ];

  const atmaThemes = [
    'System Outage Crisis Management', 'Cross-Cultural Team Leadership', 'Handling an Upset Enterprise Client',
    'Salary & Equity Benefit Negotiation', 'Explaining a Resume Employment Gap', 'Career Transition to Management',
    'Co-Founder & Stakeholder Conflict', 'Quarterly Revenue Performance Review', 'Agile Retrospective Feedback',
    'Counter Offer Negotiation', 'Promotional Readiness Interview', 'Handling Project Scope Creep'
  ];

  const list = avatarKey === 'atma' ? atmaThemes : rayaThemes;
  const shuffled = [...list].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 4).join(', ');
}

// Endpoint 1: Generate Dynamic Roleplay Scenarios via AI
app.post('/api/generate-topics', async (req, res) => {
  try {
    const { avatarKey } = req.body;
    const avatar = AVATARS[avatarKey] || AVATARS.raya;
    const ai = getGeminiClient();

    const selectedThemes = getRandomThemes(avatarKey);
    const randomSeed = Math.floor(Math.random() * 1000000);

    const systemPrompt = avatarKey === 'atma'
      ? 'You are a professional HR recruitment & career coaching lead. Generate 4 distinct, highly realistic, and creative job interview or professional communication scenarios in English.'
      : 'You are a friendly conversation companion. Generate 4 distinct, highly creative, fun, and engaging daily life or travel roleplay scenarios in English.';

    const userPrompt = `Generate 4 completely unique, fresh, non-repetitive English roleplay scenarios tailored for ${avatar.name} (${avatar.role}). Incorporate or take inspiration from these themes: [${selectedThemes}]. Random Seed: ${randomSeed}. Ensure each scenario has a title, short description in Indonesian, short category tag, emoji icon, and an opening greeting in English from ${avatar.name}.`;

    const { response, modelUsed } = await generateWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 1.0,
        responseMimeType: 'application/json',
        responseSchema: topicSchema
      }
    });

    const parsed = JSON.parse(response.text);
    res.json({ topics: parsed.topics || [], modelUsed });
  } catch (err) {
    console.error('Error in /api/generate-topics:', err);
    res.status(500).json({ error: 'Gagal membuat skenario AI. Silakan coba lagi.' });
  }
});


// Endpoint 2: Start Session (Supports Custom Scenario Opening)
app.post('/api/start-session', (req, res) => {
  const { avatarKey, scenario } = req.body;
  const avatar = AVATARS[avatarKey] || AVATARS.raya;

  let greeting = avatar.greeting;
  if (scenario && scenario.starterGreeting) {
    greeting = scenario.starterGreeting;
  }

  res.json({
    avatarName: avatar.name,
    role: avatar.role,
    greeting: greeting
  });
});

// Endpoint 3: Multi-turn Chat & Grammar Evaluation
app.post('/api/chat', async (req, res) => {
  try {
    const { avatarKey, conversation, scenario } = req.body;
    const avatar = AVATARS[avatarKey] || AVATARS.raya;

    if (!Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Conversation history is required.' });
    }

    // Format conversation history for Gemini API: [{ role: 'user' | 'model', parts: [{ text: '...' }] }]
    // Ensures clean text representation for previous model turns so Gemini remembers full context perfectly
    const formattedContents = conversation.map(msg => {
      let textContent = msg.text;
      if (msg.role === 'model' && typeof textContent === 'string') {
        try {
          const parsed = JSON.parse(textContent);
          if (parsed && parsed.reply) {
            textContent = parsed.reply;
          }
        } catch (e) {
          // If not JSON string, use original textContent
        }
      }
      return {
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: textContent }]
      };
    });

    let activeSystemInstruction = avatar.systemInstruction;
    if (scenario && scenario.title) {
      activeSystemInstruction += `\n\n=== ACTIVE ROLEPLAY SCENARIO ===\nScenario Title: ${scenario.title}\nScenario Context: ${scenario.description}\nInstruction: Stay strictly in role for this scenario. Prompt and guide the user through this roleplay while maintaining your avatar persona.`;
    }

    const ai = getGeminiClient();

    const { response, modelUsed } = await generateWithFallback(ai, {
      contents: formattedContents,
      config: {
        systemInstruction: activeSystemInstruction,
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
        error: 'Format JSON dari model AI tidak valid.',
        raw: responseText
      });
    }

    res.json({ result: parsedResult, modelUsed });
  } catch (error) {
    console.error('Error in /api/chat:', error);
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


