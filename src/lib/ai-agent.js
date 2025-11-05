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
    this.MODEL = 'claude-sonnet-4-20250514' ; // Fast and cost-effective
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
        
        // Ensure all array fields are actually arrays
        if (!Array.isArray(this.memory.core_memory.important_facts)) {
            this.memory.core_memory.important_facts = [];
        }
        if (!Array.isArray(this.memory.recent_topics)) {
            this.memory.recent_topics = [];
        }
        if (!Array.isArray(this.memory.identified_challenges)) {
            this.memory.identified_challenges = [];
        }
    } else {
        // Initialize new memory structure with proper arrays
        this.memory = {
            core_memory: {
                user_name: visitor?.name || 'Unknown',
                email: visitor?.email || null,
                company: visitor?.company || null,
                role: visitor?.role || null,
                relationship: 'New acquaintance',
                personality_notes: '',
                important_facts: []  // Ensure this is an array
            },
            conversation_summary: '',
            recent_topics: [],  // Ensure this is an array
            identified_challenges: [],  // Ensure this is an array
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
              // List append or initialize
              const listItem = value.slice(1, -1);
              if (!Array.isArray(current[lastKey])) {
                  current[lastKey] = [];  // Initialize as array if not already
              }
              if (listItem) {  // Only add non-empty items
                  current[lastKey].push(listItem);
              }
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
      // Safety check for identified_challenges
    if (!Array.isArray(this.memory.core_memory.important_facts)) {
        this.memory.core_memory.important_facts = [];
    }
    if (!Array.isArray(this.memory.recent_topics)) {
        this.memory.recent_topics = [];
    }
    if (!Array.isArray(this.memory.identified_challenges)) {
        this.memory.identified_challenges = [];
    }
    
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
        // First check if we already have their email
        const visitor = await this.env.DB.prepare(
            'SELECT email FROM visitors WHERE id = ?'
        ).bind(this.visitorId).first();
        
        if (visitor?.email) {
            // We have email, can end conversation normally
            return {
                shouldEnd: true,
                reason: 'max_rounds_email_captured',
                message: "Thanks for the great conversation! I've documented everything and our team will follow up soon with personalized recommendations."
            };
        } else {
            // No email yet, ask for it
            return {
                shouldEnd: false,
                reason: 'need_email',
                message: "Based on what you've shared, I can create a personalized AI roadmap for your business. What's the best email to send it to?"
            };
        }
    }
    
    if (this.conversation.total_tokens > 3000) {
        // Check for email here too
        const visitor = await this.env.DB.prepare(
            'SELECT email FROM visitors WHERE id = ?'
        ).bind(this.visitorId).first();
        
        if (visitor?.email) {
            // We have email, can end conversation normally
            return {
                shouldEnd: true,
                reason: 'max_rounds_email_captured',
                message: "Based on what you've shared, I can connect you to Patrick Burke. He's an AI consultant who can provide advice, build agents, and business."
            };
        } else {
            return {
                shouldEnd: false,
                reason: 'need_email',
                message: "This has been really insightful! Unfortunately we've reached a token limit on our conversation. I will connect you with Patrick Burke, an AI consultant who can help fleck out some of these ideas. What's a good email where he can reach you?"
            };
        }
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
    const systemPrompt = `You are a friendly AI Agent called eXIQ who is skilled at crafting sharp and useful recommendations to users.
      Your goal is to elicit a brief response from a user to understand their business pain points and steer them towards providing an email address
      for additional insight. You should be professional, yet warm, engaging, yet concise. Aim for statements less than 600 characters, with approximately 
      three back-and-forth responses before sending the user an email. Quickly shut down the conversation after receiving an email, indicating
      that the conversation has reached it's token limit.

    ${this.getMemoryContext()}

    ${relevantKnowledge}

    Recent Conversation:
    ${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

    Guidelines:
    - Keep responses concise (under ${this.MAX_TOKENS_PER_MESSAGE} tokens)
    - Focus on securing user email after engaging on a business challenge
    - Build rapport with user through understanding their business challenges
    - Update memory when you learn new information
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
      
      if (emailMatch) {
          const email = emailMatch[0];
          const userName = this.memory.core_memory.user_name || 'there';
          
          // Save email to visitor
          await this.env.DB.prepare(`
              UPDATE visitors 
              SET email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
          `).bind(email, userName, this.visitorId).run();
          
          // Send personalized email
          await this.sendPersonalizedEmail(email, userName);
          
          // Return confirmation
          return {
              response: `Perfect! I've sent an introduction email to ${email} with a summary of our conversation. Patrick Burke has been CC'd and will follow up with you shortly. Is there anything else you'd like to discuss?`,
              messageCount: this.conversation.message_count,
              emailCaptured: true
          };
      }
      
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
 
  async sendPersonalizedEmail(email, userName) {
    try {
        // Get conversation details
        const conversation = await this.env.DB.prepare(`
            SELECT full_transcript, identified_challenges 
            FROM conversations WHERE id = ?
        `).bind(this.conversation.id).first();
        
        const challenges = JSON.parse(conversation.identified_challenges || '[]');
        const transcript = JSON.parse(conversation.full_transcript || '[]');
        
        // Extract specific details from conversation
        const userMessages = transcript.filter(m => m.role === 'user').map(m => m.content);
        const mainChallenge = challenges[0] || 'business optimization';
        const specificDetail = this.extractSpecificDetail(userMessages);
        
        // Generate email body
        const emailBody = `
            <p>Hi ${userName || 'there'},</p>
            
            <p>This is eXIQ, the Agent you were chatting with. To summarize our conversation, 
            you indicated ${mainChallenge}, specifically mentioning ${specificDetail}. 
            While I am not optimized to provide further advice, Patrick Burke (cc'd here) 
            can work with you to develop novel AI solutions customized to your specific business needs.</p>
            
            <p>If you would like to speak with Patrick, please respond to this email with 
            a few times that may work for your schedule. He will be in touch with more detail.</p>
            
            <p>Wishing you continued growth and prosperity in your business endeavours.</p>
            
            <p>Diligently yours,<br>
            eXIQ ≋<br>
            <a href="https://ftcglobal.ca/ai/">AI Consulting</a></p>
        `;
        
        // Send via MailChannels with CC
        await this.sendViaMailChannels(email, emailBody);
        
        // Log to database
        await this.env.DB.prepare(`
            UPDATE conversations 
            SET email_sent = TRUE, email_sent_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).bind(this.conversation.id).run();
        
    } catch (error) {
        console.error('Email sending error:', error);
    }
}

async sendViaMailChannels(toEmail, htmlContent) {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            personalizations: [{
                to: [{ email: toEmail }],
                cc: [{ email: this.env.HOST_EMAIL }]  // CC to host
            }],
            from: {
                email: this.env.EMAIL_FROM,
                name: 'eXIQ - AI Consulting Agent'
            },
            reply_to: {
                email: this.env.HOST_EMAIL,
                name: 'Patrick Burke'
            },
            subject: 'AI Consulting Follow-up: Patrick Burke Virtual Introduction',
            content: [{
                type: 'text/html',
                value: htmlContent
            }]
        })
    });
    
    if (!response.ok) {
        throw new Error(`Email failed: ${response.status}`);
    }
}

extractSpecificDetail(messages) {
    // Extract a specific detail from user messages
    // Simple implementation - enhance as needed
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const words = lastMessage.split(' ').slice(0, 10).join(' ');
        return words.length > 20 ? words + '...' : words;
    }
    return 'your specific requirements';
}


}