import Anthropic from '@anthropic-ai/sdk';

// Main summarization function
export async function summarizeMainChallenge(messages, apiKey) {
    const anthropic = new Anthropic({ apiKey });
    
    const conversationText = messages
        .slice(-20) // Last 20 messages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');
    
    const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        temperature: 0.3,
        messages: [{
            role: 'user',
            content: `Identify the user's MAIN business challenge from this conversation in one sentence:
            
${conversationText}

Main challenge:`
        }]
    });
    
    return response.content[0].text.trim();
}

// Name extraction functions
export function extractUserName(messages) {
    // Implementation from fix-displayName.js
}

export function extractNameFromEmail(email) {
    // Implementation from fix-displayName.js
}