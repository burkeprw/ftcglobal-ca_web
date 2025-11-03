// src/handlers/chat.js
// Handle chat messages

import { MemoryAgent } from '../lib/ai-agent.js';
import { getVisitorId } from '../lib/visitor.js';

export async function handleChat(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const { message } = await request.json();
    
    if (!message) {
      return new Response(JSON.stringify({ 
        error: 'Message is required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get visitor ID from request
    const visitorId = await getVisitorId(request, env);
    if (!visitorId) {
      return new Response(JSON.stringify({ 
        error: 'Visitor identification failed' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create agent and process message
    const agent = new MemoryAgent(env, visitorId);
    const result = await agent.chat(message);
    
    // Return response
    return new Response(JSON.stringify({
      response: result.response,
      messageCount: result.messageCount,
      recommendations: result.recommendations,
      shouldEndConversation: result.shouldEndConversation,
      visitorId: visitorId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}