// src/handlers/memory.js
// Handle memory viewing and management

import { getVisitorId } from '../lib/visitor.js';

export async function handleMemory(request, env) {
  try {
    const visitorId = await getVisitorId(request, env);
    if (!visitorId) {
      return new Response(JSON.stringify({ 
        error: 'Visitor not identified' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (request.method === 'GET') {
      // Get memory state
      const visitor = await env.DB.prepare(
        'SELECT memory_state FROM visitors WHERE id = ?'
      ).bind(visitorId).first();
      
      const memory = visitor?.memory_state 
        ? JSON.parse(visitor.memory_state)
        : {
            core_memory: {},
            conversation_summary: '',
            identified_challenges: [],
            interaction_count: 0
          };
      
      return new Response(JSON.stringify(memory), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else if (request.method === 'DELETE') {
      // Reset memory
      const defaultMemory = {
        core_memory: {
          user_name: 'Unknown',
          email: null,
          company: null,
          role: null,
          relationship: 'New acquaintance',
          personality_notes: '',
          important_facts: []
        },
        conversation_summary: '',
        recent_topics: [],
        identified_challenges: [],
        user_preferences: {},
        interaction_count: 0,
        last_interaction: null
      };
      
      await env.DB.prepare(`
        UPDATE visitors 
        SET memory_state = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(JSON.stringify(defaultMemory), visitorId).run();
      
      // Also end any active conversations
      await env.DB.prepare(`
        UPDATE conversations 
        SET ended_at = CURRENT_TIMESTAMP 
        WHERE visitor_id = ? AND ended_at IS NULL
      `).bind(visitorId).run();
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Memory reset successfully' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else {
      return new Response('Method not allowed', { status: 405 });
    }
    
  } catch (error) {
    console.error('Memory handler error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}