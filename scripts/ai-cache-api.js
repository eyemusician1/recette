// Express + Redis AI cache API for Railway/Upstash
const express = require('express');
const axios = require('axios');
const Redis = require('ioredis');
const crypto = require('crypto');

const app = express();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const PORT = process.env.PORT || 3001;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant'; // fixed: was 'llama-3.1-7b-instant' which does not exist
const CACHE_TTL = 60 * 60; // 1 hour

app.use(express.json());

function hashPrompt(messages) {
  return crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex');
}

app.post('/ai/ask', async (req, res) => {
  const { messages, max_tokens = 900, temperature = 0.35 } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });
  const key = `ai:${hashPrompt(messages)}`;

  // 1. Check cache
  try {
    const cached = await redis.get(key);
    if (cached) {
      return res.json({ cached: true, reply: cached });
    }
  } catch (e) {
    console.warn('Redis get failed, proceeding without cache:', e.message);
  }

  // 2. Call LLM
  try {
    const groqRes = await axios.post(
      GROQ_API_URL,
      {
        model: MODEL,
        max_tokens,
        temperature,
        messages,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        timeout: 20000, // 20s timeout so Railway doesn't hang indefinitely
      }
    );

    const reply = groqRes.data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return res.status(502).json({ error: 'Groq returned empty content' });
    }

    // Only cache successful non-empty replies
    try {
      await redis.set(key, reply, 'EX', CACHE_TTL);
    } catch (e) {
      console.warn('Redis set failed, continuing without caching:', e.message);
    }

    return res.json({ cached: false, reply });
  } catch (e) {
    const status = e.response?.status ?? 500;
    const message = e.response?.data?.error?.message ?? e.message;
    console.error('Groq API error:', status, message);
    return res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`AI cache API running on port ${PORT}`);
});