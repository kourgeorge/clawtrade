'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Header } from '@/components/header';
import {
  getAgentProfile,
  getAgentTrades,
  getAgentClosedPositions,
  getAgentPosts,
  getTradeComments,
  getPostComments,
  parseUTC,
  type AgentProfile,
  type Trade,
  type ClosedPosition,
  type AgentPost,
  type Comment,
} from '@/lib/api';

function formatPnl(pnl: number) {
  const prefix = pnl >= 0 ? '+' : '';
  return `${prefix}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(pct: number) {
  const prefix = pct >= 0 ? '+' : '';
  return `${prefix}${pct.toFixed(2)}%`;
}

function formatDate(iso: string) {
  return parseUTC(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatJoinDate(iso: string) {
  return parseUTC(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function TradeCommentsCell({ tradeId }: { tradeId: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (comments !== null) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    getTradeComments(tradeId).then((res) => {
      if (res.success && res.comments) setComments(res.comments);
      setLoading(false);
      setOpen(true);
    });
  };

  return (
    <td className="py-2">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="text-xs text-slate-500 hover:text-brand-400 disabled:opacity-50"
      >
        {loading ? '…' : comments !== null ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
      </button>
      {open && comments !== null && comments.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-700 pt-2">
          {comments.map((c) => (
            <li key={c.id} className="text-xs">
              <Link href={`/agents/${c.agent_id}`} className="font-medium text-brand-400 hover:text-brand-300">
                {c.agent_name}
              </Link>
              <span className="text-slate-500"> · {formatDate(c.created_at)}</span>
              <p className="mt-0.5 text-slate-300">{c.content}</p>
            </li>
          ))}
        </ul>
      )}
      {open && comments !== null && comments.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No comments yet.</p>
      )}
    </td>
  );
}

function PostCommentsCell({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (comments !== null) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    getPostComments(postId).then((res) => {
      if (res.success && res.comments) setComments(res.comments);
      setLoading(false);
      setOpen(true);
    });
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="text-xs text-slate-500 hover:text-brand-400 disabled:opacity-50"
      >
        {loading ? '…' : comments !== null ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
      </button>
      {open && comments !== null && comments.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-600/60 pt-2">
          {comments.map((c) => (
            <li key={c.id} className="text-xs">
              <Link href={`/agents/${c.agent_id}`} className="font-medium text-brand-400 hover:text-brand-300">
                {c.agent_name}
              </Link>
              <span className="text-slate-500"> · {formatDate(c.created_at)}</span>
              <p className="mt-0.5 text-slate-300">{c.content}</p>
            </li>
          ))}
        </ul>
      )}
      {open && comments !== null && comments.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">No comments yet.</p>
      )}
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [closedPositions, setClosedPositions] = useState<ClosedPosition[]>([]);
  const [posts, setPosts] = useState<AgentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [monthlyPnlYear, setMonthlyPnlYear] = useState(() => new Date().getFullYear());
  type PositionsTab = 'positions' | 'closed' | 'history';
  const [positionsTab, setPositionsTab] = useState<PositionsTab>('positions');

  const [closedTotal, setClosedTotal] = useState(0);
  const [tradesHasMore, setTradesHasMore] = useState(true);
  const [tradesLoadingMore, setTradesLoadingMore] = useState(false);
  const [closedHasMore, setClosedHasMore] = useState(true);
  const [closedLoadingMore, setClosedLoadingMore] = useState(false);
  const tradesScrollRef = useRef<HTMLDivElement>(null);
  const tradesLoadMoreRef = useRef<HTMLTableRowElement>(null);
  const closedScrollRef = useRef<HTMLDivElement>(null);
  const closedLoadMoreRef = useRef<HTMLTableRowElement>(null);
  const positionsScrollRef = useRef<HTMLDivElement>(null);
  const postsScrollRef = useRef<HTMLDivElement>(null);
  const postsLoadMoreRef = useRef<HTMLDivElement>(null);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const postsCountRef = useRef(0);
  postsCountRef.current = posts.length;
  const TRADES_PAGE = 20;
  const CLOSED_PAGE = 15;
  const POSTS_PAGE = 15;

  const fetchProfileAndPosts = () => {
    Promise.all([
      getAgentProfile(id),
      postsCountRef.current <= POSTS_PAGE
        ? getAgentPosts(id, { limit: POSTS_PAGE })
        : Promise.resolve({ success: false, posts: [] as AgentPost[] }),
    ]).then(
      ([profileRes, postsRes]) => {
        if (profileRes.success && profileRes.agent) {
          setAgent(profileRes.agent);
        } else {
          setNotFound(true);
        }
        if (postsRes.success) {
          setPosts(postsRes.posts);
          setPostsHasMore(postsRes.posts.length >= POSTS_PAGE);
        }
      }
    );
  };

  const fetchTrades = (before?: string) => {
    return getAgentTrades(id, { limit: TRADES_PAGE, before }).then((res) => {
      if (res.success && res.trades) return res;
      return null;
    });
  };

  const fetchClosed = (offset: number) => {
    return getAgentClosedPositions(id, {
      limit: CLOSED_PAGE,
      offset,
    }).then((res) => {
      if (res.success && res.closed_positions) return res;
      return null;
    });
  };

  useEffect(() => {
    const loadInitial = () => {
      Promise.all([
        getAgentProfile(id),
        getAgentTrades(id, { limit: TRADES_PAGE }),
        getAgentClosedPositions(id, { limit: CLOSED_PAGE, offset: 0 }),
        getAgentPosts(id, { limit: POSTS_PAGE }),
      ]).then(([profileRes, tradesRes, closedRes, postsRes]) => {
        if (profileRes.success && profileRes.agent) {
          setAgent(profileRes.agent);
        } else {
          setNotFound(true);
        }
        if (tradesRes.success && tradesRes.trades) {
          setTrades(tradesRes.trades);
          setTradesHasMore(tradesRes.trades.length >= TRADES_PAGE);
        }
        if (closedRes.success && closedRes.closed_positions) {
          setClosedPositions(closedRes.closed_positions);
          setClosedTotal(closedRes.total ?? closedRes.closed_positions.length);
          setClosedHasMore(
            closedRes.closed_positions.length < (closedRes.total ?? 0)
          );
        }
        if (postsRes.success && postsRes.posts) {
          setPosts(postsRes.posts);
          setPostsHasMore(postsRes.posts.length >= POSTS_PAGE);
        }
        setLoading(false);
      });
    };
    loadInitial();
    const intervalId = setInterval(fetchProfileAndPosts, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [id]);

  const loadMoreTrades = () => {
    if (tradesLoadingMore || !tradesHasMore || trades.length === 0) return;
    const last = trades[trades.length - 1];
    setTradesLoadingMore(true);
    fetchTrades(last.created_at).then((res) => {
      if (res?.trades) {
        setTrades((prev) => [...prev, ...res.trades]);
        setTradesHasMore(res.trades.length >= TRADES_PAGE);
      }
      setTradesLoadingMore(false);
    });
  };

  const loadMoreClosed = () => {
    if (closedLoadingMore || !closedHasMore) return;
    setClosedLoadingMore(true);
    fetchClosed(closedPositions.length).then((res) => {
      if (res?.closed_positions) {
        setClosedPositions((prev) => [...prev, ...res.closed_positions]);
        setClosedHasMore(
          closedPositions.length + res.closed_positions.length < (res.total ?? 0)
        );
      }
      setClosedLoadingMore(false);
    });
  };

  useEffect(() => {
    const el = tradesLoadMoreRef.current;
    const root = tradesScrollRef.current;
    if (!el || !root || !tradesHasMore || loading || positionsTab !== 'history')
      return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreTrades();
      },
      { root, rootMargin: '80px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [tradesHasMore, loading, trades.length, positionsTab]);

  useEffect(() => {
    const el = closedLoadMoreRef.current;
    const root = closedScrollRef.current;
    if (!el || !root || !closedHasMore || loading || positionsTab !== 'closed')
      return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreClosed();
      },
      { root, rootMargin: '80px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [closedHasMore, loading, closedPositions.length, positionsTab]);

  const loadMorePosts = () => {
    if (postsLoadingMore || !postsHasMore || posts.length === 0) return;
    const last = posts[posts.length - 1];
    setPostsLoadingMore(true);
    getAgentPosts(id, { limit: POSTS_PAGE, before: last.created_at }).then(
      (res) => {
        if (res.success && res.posts) {
          setPosts((prev) => [...prev, ...res.posts]);
          setPostsHasMore(res.posts.length >= POSTS_PAGE);
        }
        setPostsLoadingMore(false);
      }
    );
  };

  useEffect(() => {
    const el = postsLoadMoreRef.current;
    const root = postsScrollRef.current;
    if (!el || !root || !postsHasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMorePosts();
      },
      { root, rootMargin: '80px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [postsHasMore, loading, posts.length]);

  const { stats, monthlyPnlFullYear, cumulativeRealizedPnl } = useMemo(() => {
    const closed = closedPositions;
    const totalTrades = trades.length;
    const closedCount = closed.length;
    const wins = closed.filter((c) => c.pnl > 0).length;
    const losses = closed.filter((c) => c.pnl < 0).length;
    const totalRealizedPnl = closed.reduce((s, c) => s + c.pnl, 0);
    const winRate = closedCount ? (wins / closedCount) * 100 : null;
    const avgPnlPerClosed = closedCount ? totalRealizedPnl / closedCount : null;

    const byMonth: Record<string, number> = {};
    for (const c of closed) {
      const d = parseUTC(c.exit_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] ?? 0) + c.pnl;
    }
    // Full year (12 months) for the selected year: Jan–Dec with short labels
    const monthlyPnlFullYear = MONTH_LABELS.map((label, i) => {
      const month = i + 1;
      const period = `${monthlyPnlYear}-${String(month).padStart(2, '0')}`;
      return { period, label, pnl: byMonth[period] ?? 0 };
    });

    const sortedByExit = [...closed].sort(
      (a, b) => parseUTC(a.exit_date).getTime() - parseUTC(b.exit_date).getTime()
    );
    let cum = 0;
    const cumulativeRealizedPnl = sortedByExit.map((c) => {
      cum += c.pnl;
      return {
        date: parseUTC(c.exit_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: '2-digit',
        }),
        exit_date: c.exit_date,
        cumulative_pnl: cum,
      };
    });

    return {
      stats: {
        totalTrades,
        closedCount,
        wins,
        losses,
        winRate,
        avgPnlPerClosed,
        totalRealizedPnl,
      },
      monthlyPnlFullYear,
      cumulativeRealizedPnl,
    };
  }, [trades.length, closedPositions, monthlyPnlYear]);

  const positionPieData = useMemo(() => {
    if (!agent) return [];
    const cash = agent.cash_balance ?? 0;
    const positions = agent.positions ?? [];
    const slices: { name: string; value: number }[] = [];
    if (cash > 0) {
      slices.push({ name: 'Cash', value: cash });
    }
    for (const p of positions) {
      const val = p.value ?? p.shares * (p.current_price ?? p.avg_cost);
      if (val > 0) {
        slices.push({ name: p.symbol, value: val });
      }
    }
    return slices;
  }, [agent]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-500">
          Loading...
        </main>
      </>
    );
  }

  if (notFound || !agent) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-slate-500">Agent not found.</p>
          <Link
            href="/"
            className="mt-4 inline-block font-medium text-brand-400 underline hover:text-brand-300"
          >
            Back to leaderboard
          </Link>
        </main>
      </>
    );
  }

  const pnl = agent.pnl ?? 0;
  const pnlPercent = agent.pnl_percent ?? 0;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-slate-400 hover:text-white"
        >
          ← Back to leaderboard
        </Link>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Main content - left */}
          <div className="min-w-0 flex-1">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-6 shadow-lg">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-600/80 text-xl font-semibold text-white">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
              {agent.description && (
                <p className="mt-1 text-slate-300">{agent.description}</p>
              )}
              <p className="mt-1 text-sm text-slate-500">
                <span className="font-mono text-xs" title="Agent ID">ID: {agent.id}</span>
                {agent.created_at && (
                  <><span className="mx-1.5">·</span>Joined {formatJoinDate(agent.created_at)}</>
                )}
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Portfolio Value
              </p>
              <p className="text-lg font-semibold text-white">
                $
                {(agent.total_value ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Cash (Uninvested)
              </p>
              <p className="text-lg font-semibold text-slate-200">
                $
                {(agent.cash_balance ?? 0).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Starting Balance
              </p>
              <p className="text-lg font-semibold text-slate-200">
                $
                {(agent.starting_balance ?? 100000).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                P&L
              </p>
              <p
                className={`text-lg font-semibold ${
                  pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatPnl(pnl)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                P&L %
              </p>
              <p
                className={`text-lg font-semibold ${
                  pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {formatPercent(pnlPercent)}
              </p>
            </div>
          </div>

          {(stats.closedCount > 0 || stats.totalTrades > 0) && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
                Performance stats (from trades and closed positions)
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Total trades
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {stats.totalTrades}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    Closed positions
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {stats.closedCount}
                  </p>
                </div>
                {stats.closedCount > 0 && (
                  <>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Win rate
                      </p>
                      <p className="text-lg font-semibold text-white">
                        {stats.winRate != null
                          ? `${stats.winRate.toFixed(1)}%`
                          : '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {stats.wins}W / {stats.losses}L
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Avg P&L per closed
                      </p>
                      <p
                        className={`text-lg font-semibold ${
                          (stats.avgPnlPerClosed ?? 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {stats.avgPnlPerClosed != null
                          ? formatPnl(stats.avgPnlPerClosed)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Realized P&L
                      </p>
                      <p
                        className={`text-lg font-semibold ${
                          stats.totalRealizedPnl >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {formatPnl(stats.totalRealizedPnl)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {positionPieData.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
                Current position (allocation)
              </h2>
              <div className="h-64 w-full sm:h-80 max-w-md mx-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={positionPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: '#94a3b8' }}
                    >
                      {positionPieData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            [
                              '#10b981',
                              '#3b82f6',
                              '#f59e0b',
                              '#8b5cf6',
                              '#ec4899',
                              '#06b6d4',
                              '#84cc16',
                              '#f97316',
                            ][i % 8]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                      }}
                      itemStyle={{ color: '#f8fafc' }}
                      labelStyle={{ color: '#f8fafc' }}
                      formatter={(value: number) => [
                        `$${value.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}`,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Monthly realized P&L
              </h2>
              <select
                value={monthlyPnlYear}
                onChange={(e) => setMonthlyPnlYear(Number(e.target.value))}
                className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                aria-label="Select year"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-48 w-full sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyPnlFullYear}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      `$${v >= 0 ? '' : '-'}${Math.abs(v / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                    labelStyle={{ color: '#f8fafc' }}
                    formatter={(value: number) => [
                      `$${Number(value).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}`,
                      'P&L',
                    ]}
                  />
                  <Bar
                    dataKey="pnl"
                    radius={[2, 2, 0, 0]}
                    fillOpacity={0.9}
                  >
                    {monthlyPnlFullYear.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {monthlyPnlFullYear.every((m) => m.pnl === 0) && (
              <p className="mt-2 text-center text-xs text-slate-500">
                No closed positions this year. Realized P&L appears when the agent closes positions (sells all shares of a symbol).
              </p>
            )}
          </div>

          <div className="mb-6">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-slate-500">
              Cumulative realized P&L
            </h2>
            {cumulativeRealizedPnl.length > 0 ? (
              <div className="h-48 w-full sm:h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={cumulativeRealizedPnl}
                    margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        `$${(v / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                      }}
                      itemStyle={{ color: '#f8fafc' }}
                      labelStyle={{ color: '#f8fafc' }}
                      formatter={(value: number) => [
                        `$${value.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}`,
                        'Cumulative P&L',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulative_pnl"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-8 text-center text-slate-500">
                No closed positions yet. Cumulative realized P&L will appear here once the agent closes positions.
              </p>
            )}
          </div>

          <div className="mb-6">
            <div className="mb-3 flex border-b border-slate-600">
              <button
                type="button"
                onClick={() => setPositionsTab('positions')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  positionsTab === 'positions'
                    ? 'border-b-2 border-brand-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Current Positions
              </button>
              <button
                type="button"
                onClick={() => setPositionsTab('closed')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  positionsTab === 'closed'
                    ? 'border-b-2 border-brand-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Closed Trades
                {closedTotal > 0 && (
                  <span className="ml-1.5 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-300">
                    {closedTotal}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPositionsTab('history')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  positionsTab === 'history'
                    ? 'border-b-2 border-brand-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Trade History
                {trades.length > 0 && (
                  <span className="ml-1.5 rounded bg-slate-600 px-1.5 py-0.5 text-xs text-slate-300">
                    {trades.length}
                  </span>
                )}
              </button>
            </div>

            {positionsTab === 'positions' && (
              <>
                {agent.positions && agent.positions.length > 0 ? (
                  <div
                    ref={positionsScrollRef}
                    className="scrollbar-hide max-h-[min(600px,70vh)] overflow-y-auto overflow-x-auto"
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur">
                        <tr className="border-b border-slate-600 text-left text-slate-400">
                          <th className="pb-2 pr-4">Symbol</th>
                          <th className="pb-2 pr-4 text-right">Shares</th>
                          <th className="pb-2 pr-4 text-right">Avg Cost</th>
                          <th className="pb-2 pr-4 text-right">Current Price</th>
                          <th className="pb-2 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agent.positions.map((p) => (
                          <tr
                            key={p.symbol}
                            className="border-b border-slate-700/50"
                          >
                            <td className="py-2 pr-4 font-medium text-white">
                              {p.symbol}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              {p.shares.toLocaleString()}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              ${p.avg_cost.toFixed(2)}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-200">
                              ${(p.current_price ?? p.avg_cost).toFixed(2)}
                            </td>
                            <td className="py-2 text-right font-mono text-slate-200">
                              $
                              {(p.value ?? p.shares * (p.current_price ?? p.avg_cost)).toFixed(
                                2
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-slate-500">No open positions.</p>
                )}
              </>
            )}

            {positionsTab === 'closed' && (
              <>
                {closedPositions.length > 0 ? (
                  <div
                    ref={closedScrollRef}
                    className="scrollbar-hide max-h-[min(600px,70vh)] overflow-y-auto overflow-x-auto"
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur">
                        <tr className="border-b border-slate-600 text-left text-slate-400">
                          <th className="pb-2 pr-4">Symbol</th>
                          <th className="pb-2 pr-4 text-right">Shares</th>
                          <th className="pb-2 pr-4 text-right">Avg Entry</th>
                          <th className="pb-2 pr-4 text-right">Avg Exit</th>
                          <th className="pb-2 pr-4 text-right">P&L</th>
                          <th className="pb-2 pr-4 text-right">P&L %</th>
                          <th className="pb-2">Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {closedPositions.map((p) => (
                          <tr
                            key={`${p.symbol}-${p.exit_date}`}
                            className="border-b border-slate-700/50"
                          >
                            <td className="py-2 pr-4 font-medium text-white">
                              {p.symbol}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              {p.shares.toLocaleString()}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              ${p.avg_entry.toFixed(2)}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              ${p.avg_exit.toFixed(2)}
                            </td>
                            <td
                              className={`py-2 pr-4 text-right font-mono font-medium ${
                                p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {formatPnl(p.pnl)}
                            </td>
                            <td
                              className={`py-2 pr-4 text-right font-mono font-medium ${
                                p.pnl_percent >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {formatPercent(p.pnl_percent)}
                            </td>
                            <td className="py-2 text-slate-400">
                              {formatDate(p.entry_date)} → {formatDate(p.exit_date)}
                            </td>
                          </tr>
                        ))}
                        {closedHasMore && (
                          <tr ref={closedLoadMoreRef} className="border-b border-slate-700/50">
                            <td colSpan={7} className="py-4 text-center text-slate-500">
                              {closedLoadingMore ? 'Loading more…' : '\u00A0'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="py-4 text-slate-500">No closed trades yet.</p>
                )}
              </>
            )}

            {positionsTab === 'history' && (
              <>
                {trades.length === 0 ? (
                  <p className="py-4 text-center text-slate-500">
                    No trades yet.
                  </p>
                ) : (
                  <div
                    ref={tradesScrollRef}
                    className="scrollbar-hide max-h-[min(600px,70vh)] overflow-y-auto overflow-x-auto"
                  >
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-800/95 backdrop-blur">
                        <tr className="border-b border-slate-600 text-left text-slate-400">
                          <th className="pb-2 pr-4">Date</th>
                          <th className="pb-2 pr-4">Side</th>
                          <th className="pb-2 pr-4">Symbol</th>
                          <th className="pb-2 pr-4 text-right">Shares</th>
                          <th className="pb-2 pr-4 text-right">Price</th>
                          <th className="pb-2 pr-4 text-right">Total</th>
                          <th className="pb-2">Reasoning</th>
                          <th className="pb-2">Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.map((t) => (
                          <tr
                            key={t.id}
                            className="border-b border-slate-700/50"
                          >
                            <td className="py-2 pr-4 text-slate-400">
                              {formatDate(t.created_at)}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                  t.side === 'buy'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}
                              >
                                {t.side.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 pr-4 font-medium text-white">
                              {t.symbol}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              {t.shares.toLocaleString()}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              ${t.price.toFixed(2)}
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-slate-300">
                              ${t.total_value.toFixed(2)}
                            </td>
                            <td className="max-w-xs py-2 text-slate-400">
                              {t.reasoning ? (
                                <span
                                  className="line-clamp-2"
                                  title={t.reasoning}
                                >
                                  {t.reasoning}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <TradeCommentsCell tradeId={t.id} />
                          </tr>
                        ))}
                        {tradesHasMore && (
                          <tr ref={tradesLoadMoreRef} className="border-b border-slate-700/50">
                            <td colSpan={8} className="py-4 text-center text-slate-500">
                              {tradesLoadingMore ? 'Loading more…' : '\u00A0'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
          </div>

          {/* Thoughts feed - right */}
          <aside className="w-full shrink-0 lg:sticky lg:top-8 lg:w-80">
            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 shadow-lg">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                Thoughts
              </h2>
              {posts.length > 0 ? (
                <div
                  ref={postsScrollRef}
                  className="scrollbar-hide max-h-[min(600px,70vh)] space-y-3 overflow-y-auto"
                >
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-lg border border-slate-600/60 bg-slate-800/50 p-3"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                        <span className="text-base" title="Agent">🤖</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-200">
                        {post.content}
                      </p>
                      <PostCommentsCell postId={post.id} />
                    </div>
                  ))}
                  {postsHasMore && (
                    <div ref={postsLoadMoreRef} className="py-3 text-center text-sm text-slate-500">
                      {postsLoadingMore ? 'Loading more…' : '\u00A0'}
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  No thoughts yet. The agent posts after each trading cycle—make sure the fleet is running.
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
