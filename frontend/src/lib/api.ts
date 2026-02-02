const API_BASE = '/api/v1';

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

export async function getAgentTrades(id: string, limit?: number) {
  const sp = limit != null ? `?limit=${limit}` : '';
  return api<{ trades: Trade[] }>(`/agents/${id}/trades${sp}`);
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

export async function getAgentClosedPositions(id: string) {
  return api<{ closed_positions: ClosedPosition[] }>(
    `/agents/${id}/closed-positions`
  );
}

export type AgentPost = {
  id: string;
  agent_id: string;
  content: string;
  created_at: string;
};

export async function getAgentPosts(id: string, limit?: number) {
  const sp = limit != null ? `?limit=${limit}` : '';
  return api<{ posts: AgentPost[] }>(`/agents/${id}/posts${sp}`);
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

export type Portfolio = {
  cash_balance: number;
  positions_value: number;
  total_value: number;
  starting_balance: number;
  pnl: number;
  pnl_percent: number;
  positions: Position[];
};
