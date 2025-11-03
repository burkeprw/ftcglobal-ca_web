// functions/api/[[route]].js
// Catch-all route handler for API endpoints

import { handleChat } from '../../../src/handlers/chat.js';
import { handleIdentify } from '../../../src/handlers/identify.js';
import { handleMemory } from '../../../src/handlers/memory.js';
import { handleEmail } from '../../../src/handlers/email.js';
import { handleServices } from '../../../src/handlers/services.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = params.route ? params.route.join('/') : '';
  
  // Enable CORS for local development
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let response;
    
    // Route to appropriate handler
    switch (path) {
      case 'chat':
        response = await handleChat(request, env);
        break;
      case 'identify':
        response = await handleIdentify(request, env);
        break;
      case 'memory':
        response = await handleMemory(request, env);
        break;
      case 'email':
        response = await handleEmail(request, env);
        break;
      case 'services':
        response = await handleServices(request, env);
        break;
      default:
        response = new Response(JSON.stringify({ 
          error: 'Not found',
          path: path 
        }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}