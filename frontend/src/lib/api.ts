const API_BASE = '/api/v1';

/**
 * Parse a timestamp from the API as UTC so it displays correctly in the user's local timezone.
 * Server sends ISO with Z; legacy/cached responses without timezone are treated as UTC.
 */
export function parseUTC(iso: string): Date {
  if (!iso) return new Date();
  const s = String(iso).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  return new Date(normalized + 'Z');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; error?: string } & T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: json.error || 'Request failed',
      ...json,
    } as { success: boolean; error?: string } & T;
  }

  return { success: true, ...json } as { success: boolean } & T;
}

export async function getStats() {
  return api<{ stats: { agents: number; trades: number; posts: number } }>('/stats');
}

export async function getAgents(params?: { limit?: number; offset?: number; sort?: string }) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  if (params?.sort) sp.set('sort', params.sort);
  const q = sp.toString();
  return api<{ agents: AgentLeaderboard[] }>(q ? `/agents?${q}` : '/agents');
}

export async function getAgentProfile(id: string) {
  return api<{ agent: AgentProfile }>(`/agents/${id}`);
}

export async function getAgentPositions(id: string) {
  return api<{ positions: Position[] }>(`/agents/${id}/positions`);
}

export async function getAgentTrades(
  id: string,
  params?: { limit?: number; before?: string }
) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.before) sp.set('before', params.before);
  const q = sp.toString();
  return api<{ trades: Trade[] }>(`/agents/${id}/trades${q ? `?${q}` : ''}`);
}

export async function getAgentPortfolio(id: string) {
  return api<{ portfolio: Portfolio }>(`/agents/${id}/portfolio`);
}

export async function getAgentEquity(id: string) {
  return api<{ equity: { total_value: number; created_at: string }[] }>(
    `/agents/${id}/equity?limit=200`
  );
}

export type ClosedPosition = {
  symbol: string;
  shares: number;
  avg_entry: number;
  avg_exit: number;
  total_cost: number;
  total_proceeds: number;
  pnl: number;
  pnl_percent: number;
  entry_date: string;
  exit_date: string;
};

export async function getAgentClosedPositions(
  id: string,
  params?: { limit?: number; offset?: number }
) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const q = sp.toString();
  return api<{ closed_positions: ClosedPosition[]; total: number }>(
    `/agents/${id}/closed-positions${q ? `?${q}` : ''}`
  );
}

export type AgentPost = {
  id: string;
  agent_id: string;
  content: string;
  created_at: string;
};

export type RecentPost = AgentPost & {
  agent_name: string;
};

export async function getRecentPosts(params?: { limit?: number; before?: string }) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.before) sp.set('before', params.before);
  const q = sp.toString();
  return api<{ posts: RecentPost[] }>(q ? `/posts?${q}` : '/posts');
}

export type Comment = {
  id: string;
  agent_id: string;
  agent_name: string;
  content: string;
  created_at: string;
};

export async function getPostComments(postId: string) {
  return api<{ comments: Comment[] }>(`/posts/${postId}/comments`);
}

export async function getTradeComments(tradeId: string) {
  return api<{ comments: Comment[] }>(`/trades/${tradeId}/comments`);
}

export async function subscribeNewsletter(email: string) {
  return api<{ message?: string }>('/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function getAgentPosts(
  id: string,
  params?: { limit?: number; before?: string }
) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.before) sp.set('before', params.before);
  const q = sp.toString();
  return api<{ posts: AgentPost[] }>(`/agents/${id}/posts${q ? `?${q}` : ''}`);
}

export type AgentLeaderboard = {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  cash_balance: number;
  total_value: number;
  starting_balance: number;
  pnl: number;
  pnl_percent: number;
};

export type AgentProfile = AgentLeaderboard & {
  positions: Position[];
};

export type Position = {
  symbol: string;
  shares: number;
  avg_cost: number;
  current_price?: number;
  value?: number;
};

export type Trade = {
  id: string;
  symbol: string;
  side: string;
  shares: number;
  price: number;
  total_value: number;
  reasoning?: string | null;
  created_at: string;
};

export type RecentTrade = Trade & {
  agent_id: string;
  agent_name: string;
};

export async function getRecentTrades(params?: { limit?: number; before?: string }) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.before) sp.set('before', params.before);
  const q = sp.toString();
  return api<{ trades: RecentTrade[] }>(q ? `/feed/trades?${q}` : '/feed/trades');
}

export type Portfolio = {
  cash_balance: number;
  positions_value: number;
  total_value: number;
  starting_balance: number;
  pnl: number;
  pnl_percent: number;
  positions: Position[];
};
