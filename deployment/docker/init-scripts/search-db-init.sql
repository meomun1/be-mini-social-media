-- Search Service Database Initialization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type VARCHAR(20) NOT NULL CHECK (search_type IN ('posts', 'users', 'comments', 'media')),
    filters JSONB,
    response_time INTEGER, -- in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query VARCHAR(255) NOT NULL,
    suggestion_type VARCHAR(20) NOT NULL CHECK (suggestion_type IN ('tag', 'user', 'trending')),
    usage_count INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_search_type ON search_analytics(search_type);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_query ON search_suggestions(query);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_type ON search_suggestions(suggestion_type);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_usage_count ON search_suggestions(usage_count DESC);
