// src/handlers/identify.js
// Identify and track visitors

export async function handleIdentify(request, env) {
  try {
    // Get visitor information from Cloudflare headers
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const country = request.headers.get('CF-IPCountry') || 'unknown';
    const city = request.cf?.city || 'unknown';
    const region = request.cf?.region || 'unknown';
    const timezone = request.cf?.timezone || 'unknown';
    
    // Get browser fingerprint if provided
    const body = await request.json().catch(() => ({}));
    const fingerprint = body.fingerprint || null;
    
    // Check if visitor exists
    let visitor = await env.DB.prepare(`
      SELECT * FROM visitors 
      WHERE ip_address = ? OR (fingerprint = ? AND fingerprint IS NOT NULL)
      ORDER BY last_seen DESC LIMIT 1
    `).bind(ip, fingerprint).first();
    
    if (visitor) {
      // Update last seen
      await env.DB.prepare(`
        UPDATE visitors 
        SET last_seen = CURRENT_TIMESTAMP,
            total_conversations = total_conversations + 1
        WHERE id = ?
      `).bind(visitor.id).run();
      
      return new Response(JSON.stringify({
        visitorId: visitor.id,
        isReturning: true,
        name: visitor.name,
        email: visitor.email,
        lastSeen: visitor.last_seen,
        totalConversations: visitor.total_conversations + 1
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Create new visitor
      const result = await env.DB.prepare(`
        INSERT INTO visitors (ip_address, country, city, region, timezone, fingerprint)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `).bind(ip, country, city, region, timezone, fingerprint).first();
      
      return new Response(JSON.stringify({
        visitorId: result.id,
        isReturning: false,
        location: { country, city, region, timezone }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Identify error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}