-- schema/database.sql

-- 1. VISITORS TABLE - Track unique visitors and their memory
CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    country TEXT,
    city TEXT,
    region TEXT,
    timezone TEXT,
    email TEXT,
    name TEXT,
    company TEXT,
    role TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    memory_state TEXT, -- JSON blob for MemGPT-style memory
    preferences TEXT, -- JSON blob for user preferences
    fingerprint TEXT, -- Browser fingerprint for better identification
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visitors_ip ON visitors(ip_address);
CREATE INDEX idx_visitors_email ON visitors(email);
CREATE INDEX idx_visitors_fingerprint ON visitors(fingerprint);

-- 2. CONVERSATIONS TABLE - Store complete conversation history
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id INTEGER NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    summary TEXT,
    full_transcript TEXT, -- JSON array of messages
    identified_challenges TEXT, -- JSON array of business challenges
    recommended_services TEXT, -- JSON array of service IDs
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at DATETIME,
    conversation_quality TEXT, -- 'completed', 'abandoned', 'email_captured'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_visitor ON conversations(visitor_id);
CREATE INDEX idx_conversations_date ON conversations(started_at);

-- 3. SERVICES TABLE - Catalog of consulting services
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'AI', 'Digital Transformation', 'Strategy', etc.
    description TEXT NOT NULL,
    detailed_description TEXT,
    keywords TEXT NOT NULL, -- Comma-separated keywords for matching
    typical_challenges TEXT, -- Problems this service solves
    deliverables TEXT, -- What the client gets
    duration TEXT, -- Typical engagement length
    pricing_tier TEXT, -- 'starter', 'professional', 'enterprise'
    case_studies TEXT, -- JSON array of case study references
    success_metrics TEXT, -- How success is measured
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INTEGER DEFAULT 0, -- Times recommended
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_keywords ON services(keywords);
CREATE INDEX idx_services_active ON services(is_active);

-- 4. KNOWLEDGE_BASE TABLE - RAG content for intelligent responses
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'faq', 'article', 'case_study', 'methodology', 'industry_insight'
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Full content
    summary TEXT, -- Brief summary for quick retrieval
    chunks TEXT, -- JSON array of content chunks for RAG
    keywords TEXT, -- Extracted keywords for search
    category TEXT,
    service_ids TEXT, -- Related service IDs (comma-separated)
    metadata TEXT, -- JSON blob for additional data
    embeddings_generated BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_type ON knowledge_base(type);
CREATE INDEX idx_kb_keywords ON knowledge_base(keywords);
CREATE INDEX idx_kb_category ON knowledge_base(category);
-- Full-text search index
CREATE VIRTUAL TABLE knowledge_base_fts USING fts5(
    title, 
    content, 
    summary, 
    keywords,
    content=knowledge_base,
    content_rowid=id
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER knowledge_base_ai AFTER INSERT ON knowledge_base BEGIN
    INSERT INTO knowledge_base_fts(rowid, title, content, summary, keywords)
    VALUES (new.id, new.title, new.content, new.summary, new.keywords);
END;

CREATE TRIGGER knowledge_base_ad AFTER DELETE ON knowledge_base BEGIN
    DELETE FROM knowledge_base_fts WHERE rowid = old.id;
END;

CREATE TRIGGER knowledge_base_au AFTER UPDATE ON knowledge_base BEGIN
    DELETE FROM knowledge_base_fts WHERE rowid = old.id;
    INSERT INTO knowledge_base_fts(rowid, title, content, summary, keywords)
    VALUES (new.id, new.title, new.content, new.summary, new.keywords);
END;

-- 5. MESSAGES TABLE - Individual messages for analytics
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    visitor_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    tokens INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT, -- JSON for additional data
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_visitor ON messages(visitor_id);

-- 6. EMAIL_LOG TABLE - Track all email communications
CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id INTEGER,
    conversation_id INTEGER,
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL, -- 'visitor_summary', 'host_notification', 'follow_up'
    subject TEXT,
    content TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    sent_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX idx_email_log_visitor ON email_log(visitor_id);
CREATE INDEX idx_email_log_status ON email_log(status);

-- Insert sample services
INSERT INTO services (name, slug, category, description, keywords, typical_challenges) VALUES
('AI Strategy Consulting', 'ai-strategy', 'AI', 
 'Develop comprehensive AI adoption roadmap for your organization', 
 'artificial intelligence,machine learning,ai transformation,strategy,roadmap',
 'How to adopt AI, Where to start with AI, AI implementation strategy'),

('Custom AI Agent Development', 'custom-ai-agents', 'AI', 
 'Build tailored AI agents for customer service, sales, and operations',
 'chatbot,ai agent,automation,customer service,claude,gpt,llm',
 'Automate customer support, Improve response times, Scale customer interactions'),

('Process Automation', 'process-automation', 'Digital Transformation',
 'Identify and automate repetitive business processes',
 'automation,efficiency,workflow,rpa,process optimization',
 'Too much manual work, Inefficient processes, Human errors, Scaling issues'),

('Data Analytics & Insights', 'data-analytics', 'Analytics',
 'Transform your data into actionable business intelligence',
 'data,analytics,business intelligence,reporting,dashboards,insights',
 'No visibility into data, Need better reporting, Data-driven decisions'),

('Digital Transformation', 'digital-transformation', 'Strategy',
 'End-to-end digital transformation strategy and implementation',
 'digital,transformation,modernization,cloud,technology strategy',
 'Legacy systems, Digital competitiveness, Modern technology adoption');

-- Insert sample knowledge base entries
INSERT INTO knowledge_base (type, title, content, keywords, category) VALUES
('faq', 'What is an AI Agent?', 
 'An AI agent is an autonomous system that can perceive its environment, make decisions, and take actions to achieve specific goals. In business context, AI agents can handle customer inquiries, process documents, make recommendations, and automate complex workflows.',
 'ai agent,automation,artificial intelligence', 'AI'),

('methodology', 'Our AI Implementation Framework',
 'We follow a 5-phase approach: 1) Assessment - Evaluate current state and readiness, 2) Strategy - Define AI use cases and roadmap, 3) Pilot - Build proof of concept, 4) Implementation - Deploy and integrate, 5) Optimization - Monitor and improve performance.',
 'methodology,framework,implementation,ai strategy', 'AI'),

('case_study', 'E-commerce Customer Service Transformation',
 'Helped a major retailer reduce response time by 80% and increase customer satisfaction by 35% through custom AI agent implementation. The agent handles 70% of inquiries autonomously.',
 'case study,customer service,e-commerce,success story', 'AI');

-- Create update triggers for timestamp management
CREATE TRIGGER update_visitors_timestamp AFTER UPDATE ON visitors
BEGIN
    UPDATE visitors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_services_timestamp AFTER UPDATE ON services
BEGIN
    UPDATE services SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_knowledge_base_timestamp AFTER UPDATE ON knowledge_base
BEGIN
    UPDATE knowledge_base SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;