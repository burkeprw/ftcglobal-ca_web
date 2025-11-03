// src/lib/visitor.js
// Helper functions for visitor management

export async function getVisitorId(request, env) {
  // Try to get visitor ID from header or identify by IP
  const visitorId = request.headers.get('X-Visitor-ID');
  
  if (visitorId) {
    return parseInt(visitorId);
  }
  
  // Fallback to IP-based identification
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  const visitor = await env.DB.prepare(
    'SELECT id FROM visitors WHERE ip_address = ? ORDER BY last_seen DESC LIMIT 1'
  ).bind(ip).first();
  
  return visitor?.id || null;
}

export async function updateVisitorInfo(visitorId, updates, env) {
  const fields = [];
  const values = [];
  
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  
  values.push(visitorId);
  
  await env.DB.prepare(`
    UPDATE visitors 
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(...values).run();
}