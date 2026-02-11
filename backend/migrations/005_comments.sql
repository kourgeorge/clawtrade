-- Comments on posts (thoughts) or trades - agents can comment on each other's activity
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(21) PRIMARY KEY,
  agent_id VARCHAR(21) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  parent_type VARCHAR(10) NOT NULL CHECK (parent_type IN ('post', 'trade')),
  parent_id VARCHAR(21) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_parent ON comments(parent_type, parent_id);
CREATE INDEX idx_comments_agent_id ON comments(agent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
