// src/lib/ai-agent.js
// MemGPT-style agent with self-editing memory

import Anthropic from '@anthropic-ai/sdk';

export class MemoryAgent {
  constructor(env, visitorId) {
    this.env = env;
    this.visitorId = visitorId;
    this.memory = null;
    this.conversation = null;
    
    // Configuration
    this.MAX_ROUNDS = parseInt(env.MAX_ROUNDS || '5');
    this.MAX_TOKENS_PER_MESSAGE = parseInt(env.MAX_TOKENS_PER_MESSAGE || '500');
    this.MODEL = 'claude-3-haiku-20240307'; // Fast and cost-effective
  }

  async initialize() {
    await this.loadMemory();
    await this.loadOrCreateConversation();
  }

  async loadMemory() {
    // Load visitor's memory from database
    const visitor = await this.env.DB.prepare(
      'SELECT memory_state, name, email, company, role, preferences FROM visitors WHERE id = ?'
    ).bind(this.visitorId).first();

    if (visitor && visitor.memory_state) {
      this.memory = JSON.parse(visitor.memory_state);
    } else {
      // Initialize new memory structure
      this.memory = {
        core_memory: {
          user_name: visitor?.name || 'Unknown',
          email: visitor?.email || null,
          company: visitor?.company || null,
          role: visitor?.role || null,
          relationship: 'New acquaintance',
          personality_notes: '',
          important_facts: []
        },
        conversation_summary: '',
        recent_topics: [],
        identified_challenges: [],
        user_preferences: JSON.parse(visitor?.preferences || '{}'),
        interaction_count: 0,
        last_interaction: null
      };
    }
  }

  async loadOrCreateConversation() {
    // Check for active conversation
    const activeConv = await this.env.DB.prepare(`
      SELECT id, message_count, total_tokens, full_transcript, identified_challenges
      FROM conversations 
      WHERE visitor_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `).bind(this.visitorId).first();

    if (activeConv) {
      this.conversation = activeConv;
      this.conversation.full_transcript = JSON.parse(activeConv.full_transcript || '[]');
      this.conversation.identified_challenges = JSON.parse(activeConv.identified_challenges || '[]');
    } else {
      // Create new conversation
      const result = await this.env.DB.prepare(`
        INSERT INTO conversations (visitor_id, full_transcript, identified_challenges)
        VALUES (?, '[]', '[]')
        RETURNING id, message_count, total_tokens
      `).bind(this.visitorId).first();
      
      this.conversation = {
        id: result.id,
        message_count: 0,
        total_tokens: 0,
        full_transcript: [],
        identified_challenges: []
      };
    }
  }

  extractMemoryEdits(response) {
    // Extract memory edit commands like [MEMORY_UPDATE: key=value]
    const pattern = /\[MEMORY_UPDATE:\s*([^=]+)=([^\]]+)\]/g;
    const edits = [];
    let match;
    
    while ((match = pattern.exec(response)) !== null) {
      edits.push({
        key: match[1].trim(),
        value: match[2].trim()
      });
    }
    
    // Remove memory commands from visible response
    const cleanResponse = response.replace(pattern, '').trim();
    
    return { edits, cleanResponse };
  }

  applyMemoryEdits(edits) {
    for (const { key, value } of edits) {
      const keys = key.split('.');
      let current = this.memory;
      
      // Navigate to the correct location
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      // Apply the value
      const lastKey = keys[keys.length - 1];
      
      // Handle different value types
      if (value.toLowerCase() === 'true') {
        current[lastKey] = true;
      } else if (value.toLowerCase() === 'false') {
        current[lastKey] = false;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // List append
        const listItem = value.slice(1, -1);
        if (!Array.isArray(current[lastKey])) {
          current[lastKey] = [];
        }
        current[lastKey].push(listItem);
      } else {
        current[lastKey] = value;
      }
    }
  }

  async saveMemory() {
    await this.env.DB.prepare(`
      UPDATE visitors 
      SET memory_state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(JSON.stringify(this.memory), this.visitorId).run();
  }

  async saveMessage(role, content, tokens = 0) {
    // Add to transcript
    this.conversation.full_transcript.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    
    // Save to messages table
    await this.env.DB.prepare(`
      INSERT INTO messages (conversation_id, visitor_id, role, content, tokens)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      this.conversation.id,
      this.visitorId,
      role,
      content,
      tokens
    ).run();
    
    // Update conversation
    this.conversation.message_count++;
    this.conversation.total_tokens += tokens;
    
    await this.env.DB.prepare(`
      UPDATE conversations 
      SET message_count = ?, 
          total_tokens = ?, 
          full_transcript = ?,
          identified_challenges = ?
      WHERE id = ?
    `).bind(
      this.conversation.message_count,
      this.conversation.total_tokens,
      JSON.stringify(this.conversation.full_transcript),
      JSON.stringify(this.conversation.identified_challenges),
      this.conversation.id
    ).run();
  }

  getMemoryContext() {
    return `
=== CURRENT MEMORY STATE ===
Core Memory:
- User Name: ${this.memory.core_memory.user_name}
- Email: ${this.memory.core_memory.email || 'Not provided'}
- Company: ${this.memory.core_memory.company || 'Not provided'}
- Role: ${this.memory.core_memory.role || 'Not provided'}
- Relationship: ${this.memory.core_memory.relationship}
- Important Facts: ${this.memory.core_memory.important_facts.join(', ') || 'None yet'}

Conversation Summary: ${this.memory.conversation_summary || 'First conversation'}
Recent Topics: ${this.memory.recent_topics.slice(-5).join(', ') || 'None'}
Identified Challenges: ${this.memory.identified_challenges.join(', ') || 'None identified'}
Interaction Count: ${this.memory.interaction_count}
Message Count in Current Conversation: ${this.conversation.message_count}

=== MEMORY INSTRUCTIONS ===
You can update memory by including [MEMORY_UPDATE: key=value] commands in your response.
Examples:
- [MEMORY_UPDATE: core_memory.user_name=John]
- [MEMORY_UPDATE: core_memory.company=TechCorp]
- [MEMORY_UPDATE: core_memory.important_facts=[Needs AI for customer service]]
- [MEMORY_UPDATE: identified_challenges=[Scaling customer support]]

These commands will be hidden from the user.`;
  }

  async checkConversationLimits() {
    // Check if we've reached conversation limits
    if (this.conversation.message_count >= this.MAX_ROUNDS * 2) { // *2 for user+assistant
      return {
        shouldEnd: true,
        reason: 'max_rounds',
        message: "We've had a good conversation! To continue, please provide your email so I can send you a summary and connect you with the right consultant."
      };
    }
    
    if (this.conversation.total_tokens > 3000) {
      return {
        shouldEnd: true,
        reason: 'token_limit',
        message: "This has been a detailed discussion! Let me get your email to send you a comprehensive summary and next steps."
      };
    }
    
    return { shouldEnd: false };
  }

  async findRelevantKnowledge(query) {
    try {
      // Sanitize query for FTS5 - remove special characters and quotes
      const sanitizedQuery = query
        .replace(/[,;:!?'"()[\]{}]/g, ' ')  // Replace special chars with spaces
        .replace(/\s+/g, ' ')                // Multiple spaces to single space
        .trim();
      
      if (!sanitizedQuery) {
        return '';  // Return empty if no valid search terms
      }
      
      // Wrap each word in quotes for FTS5
      const ftsQuery = sanitizedQuery
        .split(' ')
        .filter(word => word.length > 2)  // Skip very short words
        .map(word => `"${word}"`)
        .join(' OR ');
      
      if (!ftsQuery) {
        return '';  // No valid search terms
      }
      
      // Search knowledge base for relevant information
      const knowledge = await this.env.DB.prepare(`
        SELECT title, content, summary
        FROM knowledge_base_fts
        WHERE knowledge_base_fts MATCH ?
        ORDER BY rank
        LIMIT 3
      `).bind(ftsQuery).all();
      
      if (knowledge.results && knowledge.results.length > 0) {
        return '\n\nRelevant Knowledge:\n' + 
          knowledge.results.map(k => `- ${k.title}: ${k.summary}`).join('\n');
      }
    } catch (error) {
      console.error('Knowledge search error:', error);
      // If FTS table doesn't exist or other error, just continue without knowledge
    }
    
    return '';
  }

  async recommendServices(challenges) {
    try {
      // Sanitize challenges text
      const searchTerm = challenges.replace(/['"]/g, '').substring(0, 100);
      
      // Find matching services based on challenges
      const services = await this.env.DB.prepare(`
        SELECT name, description, keywords
        FROM services
        WHERE is_active = 1
          AND (keywords LIKE ? OR typical_challenges LIKE ?)
        LIMIT 3
      `).bind(
        `%${searchTerm}%`,
        `%${searchTerm}%`
      ).all();
      
      return services.results || [];
    } catch (error) {
      console.error('Service recommendation error:', error);
      return [];
    }
  }

  async chat(userMessage) {
    await this.initialize();
    
    console.log('=== DEBUG API KEY ===');
    console.log('API Key exists:', !!this.env.CLAUDE_API_KEY);
    console.log('API Key starts with:', this.env.CLAUDE_API_KEY?.substring(0, 15) + '...');
    console.log('===================');

    // Check conversation limits
    const limits = await this.checkConversationLimits();
    if (limits.shouldEnd) {
      await this.saveMessage('user', userMessage);
      await this.saveMessage('assistant', limits.message);
      return {
        response: limits.message,
        shouldEndConversation: true,
        reason: limits.reason
      };
    }
    
    // Update interaction tracking
    this.memory.interaction_count++;
    this.memory.last_interaction = new Date().toISOString();
    
    // Search for relevant knowledge
    const relevantKnowledge = await this.findRelevantKnowledge(userMessage);
    
    // Build conversation history for context
    const recentMessages = this.conversation.full_transcript.slice(-4);
    
    // Build the system prompt
    const systemPrompt = `You are a friendly AI consultant helping identify business challenges and recommend solutions.
Your goal is to understand the user's needs and guide them toward relevant consulting services.
You should be professional yet conversational, and aim to capture their email for follow-up.

${this.getMemoryContext()}

${relevantKnowledge}

Recent Conversation:
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Guidelines:
- Keep responses concise (under ${this.MAX_TOKENS_PER_MESSAGE} tokens)
- Focus on understanding their business challenges
- Update memory when you learn new information
- After 3-4 exchanges, suggest getting their email for a detailed proposal
- Be helpful but guide toward concrete next steps`;

    try {
      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: this.env.CLAUDE_API_KEY,
      });
      
      // Call Claude API
      const response = await anthropic.messages.create({
        model: this.MODEL,
        max_tokens: this.MAX_TOKENS_PER_MESSAGE,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      });
      
      const aiResponse = response.content[0].text;
      
      // Extract and apply memory edits
      const { edits, cleanResponse } = this.extractMemoryEdits(aiResponse);
      if (edits.length > 0) {
        this.applyMemoryEdits(edits);
        
        // Extract any identified challenges
        const challengeEdit = edits.find(e => e.key.includes('identified_challenges'));
        if (challengeEdit) {
          this.conversation.identified_challenges.push(challengeEdit.value);
        }
      }
      
      // Save messages
      await this.saveMessage('user', userMessage, userMessage.length / 4); // Rough token estimate
      await this.saveMessage('assistant', cleanResponse, response.usage?.output_tokens || cleanResponse.length / 4);
      
      // Save updated memory
      await this.saveMemory();
      
      // Check if we should recommend services
      let recommendations = [];
      if (this.conversation.identified_challenges.length > 0) {
        recommendations = await this.recommendServices(
          this.conversation.identified_challenges.join(' ')
        );
      }
      
      return {
        response: cleanResponse,
        messageCount: this.conversation.message_count,
        recommendations: recommendations,
        shouldEndConversation: false
      };
      
    } catch (error) {
      console.error('Claude API Error:', error);
      throw new Error(`AI processing error: ${error.message}`);
    }
  }
}