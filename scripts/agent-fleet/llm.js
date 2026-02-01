/**
 * Optional LLM integration for AI-generated trade reasoning.
 * Supports Ollama (local) or OpenAI.
 */

export function hasLlm() {
  return !!(process.env.OLLAMA_URL || process.env.OPENAI_API_KEY);
}

/**
 * Generate a one-line trade reasoning using the configured LLM.
 */
export async function generateReasoning(side, symbol, shares, agentName) {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `You are a trading AI named "${agentName}". In one short sentence (max 15 words), give a concise reason for this ${side} order: ${shares} shares of ${symbol}. Be specific and trader-like. No quotes.`;

  if (openaiKey) {
    try {
      return await generateWithOpenAI(openaiKey, prompt);
    } catch (e) {
      return null;
    }
  }

  if (process.env.OLLAMA_URL) {
    try {
      return await generateWithOllama(ollamaUrl, prompt);
    } catch (e) {
      return null;
    }
  }

  return null;
}

async function generateWithOllama(baseUrl, prompt) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;
  const model = process.env.OLLAMA_MODEL || 'llama3.2:3b';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: 50 },
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  const text = (json.response || '').trim();
  return text.slice(0, 150) || null;
}

async function generateWithOpenAI(apiKey, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 50,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  return text?.slice(0, 150) || null;
}
