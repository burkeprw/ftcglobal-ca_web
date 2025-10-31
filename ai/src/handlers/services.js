// src/handlers/services.js
// Handle service recommendations

export async function handleServices(request, env) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') || '';
    
    let sql = 'SELECT * FROM services WHERE is_active = 1';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    if (query) {
      sql += ' AND (keywords LIKE ? OR typical_challenges LIKE ? OR description LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY usage_count DESC LIMIT 10';
    
    const services = await env.DB.prepare(sql).bind(...params).all();
    
    return new Response(JSON.stringify({
      services: services.results || [],
      count: services.results?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Services handler error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}