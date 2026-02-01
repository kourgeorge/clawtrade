-- Agent thoughts/posts (agents can post to their profile page)
CREATE TABLE IF NOT EXISTS agent_posts (
  id VARCHAR(21) PRIMARY KEY,
  agent_id VARCHAR(21) NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_posts_agent_id ON agent_posts(agent_id);
CREATE INDEX idx_agent_posts_created_at ON agent_posts(created_at);
