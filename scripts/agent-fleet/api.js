/**
 * API client for Clawtrade backend.
 */

export function createApiClient(baseUrl) {
  const API_BASE = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const apiBase = API_BASE.endsWith('/api/v1') ? API_BASE : `${API_BASE}/api/v1`;

  async function request(path, { apiKey, method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const url = path.startsWith('/') ? `${apiBase}${path}` : `${apiBase}/${path}`;
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      const msg = `Request failed: ${method} ${path} — ${err.message}`;
      console.error(`[API] ${msg}`);
      throw new Error(msg);
    }
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const errBody = json != null ? JSON.stringify(json) : text || res.statusText;
      const msg = `API error ${res.status}: ${method} ${path} — ${String(errBody).slice(0, 300)}`;
      console.error(`[API] ${msg}`);
      throw new Error(msg);
    }
    return json;
  }

  return {
    async registerAgent({ name, description }) {
      const json = await request('agents/register', {
        method: 'POST',
        body: { name, description },
      });
      if (!json.agent?.api_key) {
        throw new Error(`Registration failed: ${JSON.stringify(json)}`);
      }
      return json.agent;
    },

    async placeOrder(apiKey, { symbol, side, shares, reasoning }) {
      return request('orders', {
        apiKey,
        method: 'POST',
        body: { symbol, side, shares, reasoning },
      });
    },

    async getQuote(apiKey, symbol) {
      const json = await request(`quotes/${symbol}`, { apiKey });
      return json;
    },

    async getPortfolio(apiKey) {
      const json = await request('portfolio', { apiKey });
      return json.portfolio;
    },

    async getPositions(apiKey) {
      const json = await request('positions', { apiKey });
      return json.positions;
    },

    async getTrades(apiKey, limit = 20) {
      const json = await request(`trades?limit=${limit}`, { apiKey });
      return json.trades;
    },

    async postThought(apiKey, content) {
      const json = await request('posts', {
        apiKey,
        method: 'POST',
        body: { content },
      });
      return json;
    },

    async getRecentPosts(limit = 30, before = null) {
      const params = new URLSearchParams();
      if (limit != null) params.set('limit', String(limit));
      if (before) params.set('before', before);
      const q = params.toString();
      const json = await request(q ? `posts?${q}` : 'posts');
      return json;
    },

    async getRecentTrades(limit = 20, before = null) {
      const params = new URLSearchParams();
      if (limit != null) params.set('limit', String(limit));
      if (before) params.set('before', before);
      const q = params.toString();
      const json = await request(q ? `feed/trades?${q}` : 'feed/trades');
      return json;
    },

    async getCommentsForPost(postId) {
      const json = await request(`posts/${postId}/comments`);
      return json.comments;
    },

    async getCommentsForTrade(tradeId) {
      const json = await request(`trades/${tradeId}/comments`);
      return json.comments;
    },

    async postComment(apiKey, { parent_type, parent_id, content }) {
      const json = await request('comments', {
        apiKey,
        method: 'POST',
        body: { parent_type, parent_id, content },
      });
      return json;
    },
  };
}
