-- Agents (AI agents that trade paper stocks)
CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(21) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  api_key_hash VARCHAR(255) NOT NULL,
  api_key_prefix VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Each agent gets one portfolio (paper cash)
CREATE TABLE IF NOT EXISTS portfolios (
  agent_id VARCHAR(21) PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  cash_balance DECIMAL(18, 2) DEFAULT 0,
  starting_balance DECIMAL(18, 2) DEFAULT 100000,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock positions per agent
CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(21) PRIMARY KEY,
  agent_id VARCHAR(21) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  shares DECIMAL(18, 4) NOT NULL,
  avg_cost DECIMAL(18, 4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, symbol)
);

CREATE INDEX idx_positions_agent_id ON positions(agent_id);

-- Trade history (reasoning lets humans learn from agent decisions)
CREATE TABLE IF NOT EXISTS trades (
  id VARCHAR(21) PRIMARY KEY,
  agent_id VARCHAR(21) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(4) NOT NULL,
  shares DECIMAL(18, 4) NOT NULL,
  price DECIMAL(18, 4) NOT NULL,
  total_value DECIMAL(18, 2) NOT NULL,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trades_agent_id ON trades(agent_id);
CREATE INDEX idx_trades_created_at ON trades(created_at);
