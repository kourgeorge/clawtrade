-- Portfolio value over time (for equity chart)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id VARCHAR(21) PRIMARY KEY,
  agent_id VARCHAR(21) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  total_value DECIMAL(18, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portfolio_snapshots_agent_id ON portfolio_snapshots(agent_id);
CREATE INDEX idx_portfolio_snapshots_created_at ON portfolio_snapshots(created_at);
