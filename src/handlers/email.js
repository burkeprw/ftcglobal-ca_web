// src/handlers/email.js
// Handle email sending with conversation summaries


import { summarizeMainChallenge, extractUserName, extractNameFromEmail } from './ai-summarizer.js';

export async function handleEmail(request, env, ctx) {
    // ... existing code ...
    
    // When email is captured, enhance the process:
    const displayName = extractUserName(messages) || 
                       extractNameFromEmail(email);
    
    const mainChallenge = await summarizeMainChallenge(messages, env.ANTHROPIC_API_KEY);
    
    // Send enhanced email
    await sendEnhancedEmail(email, displayName, mainChallenge, messages, env);
}

/*
import { getVisitorId, updateVisitorInfo } from '../lib/visitor.js';

export async function handleEmail(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const { email, name, company } = await request.json();
    
    if (!email) {
      return new Response(JSON.stringify({ 
        error: 'Email is required' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const visitorId = await getVisitorId(request, env);
    if (!visitorId) {
      return new Response(JSON.stringify({ 
        error: 'Visitor not identified' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update visitor information
    await updateVisitorInfo(visitorId, {
      email,
      name: name || null,
      company: company || null
    }, env);
    
    // Get current conversation and visitor details
    const conversation = await env.DB.prepare(`
      SELECT c.*, v.name, v.company, v.country, v.city, v.memory_state
      FROM conversations c
      JOIN visitors v ON c.visitor_id = v.id
      WHERE c.visitor_id = ? AND c.ended_at IS NULL
      ORDER BY c.started_at DESC LIMIT 1
    `).bind(visitorId).first();
    
    if (!conversation) {
      return new Response(JSON.stringify({ 
        error: 'No active conversation found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse conversation data
    const transcript = JSON.parse(conversation.full_transcript || '[]');
    const challenges = JSON.parse(conversation.identified_challenges || '[]');
    const memory = JSON.parse(conversation.memory_state || '{}');
    
    // Generate summary
    const summary = generateConversationSummary(transcript, challenges, conversation);
    
    // Save summary to conversation
    await env.DB.prepare(`
      UPDATE conversations 
      SET summary = ?, 
          ended_at = CURRENT_TIMESTAMP,
          conversation_quality = 'email_captured'
      WHERE id = ?
    `).bind(summary, conversation.id).run();
    
    // Send emails (visitor and host)
    const emailsSent = await sendEmails(env, {
      visitorEmail: email,
      visitorName: name || conversation.name || 'Visitor',
      company: company || conversation.company || 'Not provided',
      location: `${conversation.city}, ${conversation.country}`,
      summary,
      challenges,
      transcript
    });
    
    // Log email sends
    for (const emailLog of emailsSent) {
      await env.DB.prepare(`
        INSERT INTO email_log (visitor_id, conversation_id, recipient_email, email_type, subject, content, status, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        visitorId,
        conversation.id,
        emailLog.recipient,
        emailLog.type,
        emailLog.subject,
        emailLog.content,
        emailLog.status
      ).run();
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      emailsSent: emailsSent.length,
      summary
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Email handler error:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateConversationSummary(transcript, challenges, conversation) {
  // Create a concise summary
  const messageCount = transcript.length;
  const userMessages = transcript.filter(m => m.role === 'user').map(m => m.content).join(' ');
  
  // Extract key topics from user messages
  const topics = extractKeyTopics(userMessages);
  
  let summary = `Conversation Summary (${messageCount} messages, ${conversation.total_tokens} tokens):\n\n`;
  
  if (topics.length > 0) {
    summary += `Topics Discussed: ${topics.join(', ')}\n\n`;
  }
  
  if (challenges.length > 0) {
    summary += `Identified Challenges:\n${challenges.map(c => `• ${c}`).join('\n')}\n\n`;
  }
  
  summary += `The visitor engaged in a productive conversation about their business needs. `;
  summary += `They showed interest in solutions for ${challenges.length > 0 ? challenges[0] : 'business optimization'}.`;
  
  return summary;
}

function extractKeyTopics(text) {
  // Simple keyword extraction (in production, use more sophisticated NLP)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those']);
  
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordFreq = {};
  
  for (const word of words) {
    if (word.length > 3 && !commonWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }
  
  // Get top 5 most frequent words
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}
/*async function sendEmails(env, data) {
  const emailsSent = [];
  
  // Email content for visitor
  const visitorEmailContent = `
    <h2>Thank you for your interest!</h2>
    <p>Dear ${data.visitorName},</p>
    <p>Thank you for taking the time to discuss your business challenges with our AI consultant.</p>
    
    <h3>Conversation Summary:</h3>
    <p>${data.summary.replace(/\n/g, '<br>')}</p>
    
    ${data.challenges.length > 0 ? `
    <h3>Your Identified Challenges:</h3>
    <ul>
      ${data.challenges.map(c => `<li>${c}</li>`).join('')}
    </ul>
    ` : ''}
    
    <p>Our team will review your requirements and reach out within 24-48 hours with personalized recommendations.</p>
    
    <p>Best regards,<br>AI Consulting Team</p>
  `;
  
  // Email content for host
  const hostEmailContent = `
    <h2>New Lead from AI Agent</h2>
    
    <h3>Visitor Information:</h3>
    <ul>
      <li><strong>Name:</strong> ${data.visitorName}</li>
      <li><strong>Email:</strong> ${data.visitorEmail}</li>
      <li><strong>Company:</strong> ${data.company}</li>
      <li><strong>Location:</strong> ${data.location}</li>
    </ul>
    
    <h3>Conversation Summary:</h3>
    <p>${data.summary.replace(/\n/g, '<br>')}</p>
    
    ${data.challenges.length > 0 ? `
    <h3>Identified Challenges:</h3>
    <ul>
      ${data.challenges.map(c => `<li>${c}</li>`).join('')}
    </ul>
    ` : ''}
    
    <h3>Full Transcript:</h3>
    <div style="border: 1px solid #ddd; padding: 10px; max-height: 400px; overflow-y: auto;">
      ${data.transcript.map(m => `
        <p style="margin: 5px 0;">
          <strong>${m.role === 'user' ? 'Visitor' : 'AI'}:</strong> ${m.content}
        </p>
      `).join('')}
    </div>
    
    <p>Please follow up with this lead within 24-48 hours.</p>
  `;
  
  // Send to visitor
  try {
    await sendEmailViaMailChannels(env, {
      to: data.visitorEmail,
      subject: 'Your AI Consultation Summary',
      html: visitorEmailContent
    });
    
    emailsSent.push({
      recipient: data.visitorEmail,
      type: 'visitor_summary',
      subject: 'Your AI Consultation Summary',
      content: visitorEmailContent,
      status: 'sent'
    });
  } catch (error) {
    console.error('Failed to send visitor email:', error);
  }
  
  // Send to host
  try {
    await sendEmailViaMailChannels(env, {
      to: env.HOST_EMAIL,
      subject: `New Lead: ${data.visitorName} from ${data.company}`,
      html: hostEmailContent
    });
    
    emailsSent.push({
      recipient: env.HOST_EMAIL,
      type: 'host_notification',
      subject: `New Lead: ${data.visitorName}`,
      content: hostEmailContent,
      status: 'sent'
    });
  } catch (error) {
    console.error('Failed to send host email:', error);
  }
  
  return emailsSent;
}

/*async function sendEmailViaMailChannels(env, { to, subject, html }) {
  // Using MailChannels API (works with Cloudflare Workers)
  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: {
        email: env.EMAIL_FROM || 'agent@yourdomain.com',
        name: 'AI Consulting Agent',
      },
      subject: subject,
      content: [
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Email send failed: ${response.status}`);
  }
}*/

