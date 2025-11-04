// public/assets/js/chat.js
// Frontend chat interface logic

// Configuration
const API_URL = window.location.origin + '/ai';
let visitorId = null;
let conversationActive = false;
let messageCount = 0;

// Browser fingerprinting for better visitor tracking
async function getBrowserFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const dataURL = canvas.toDataURL();
    
    const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        canvas: dataURL.slice(-50) // Last 50 chars of canvas fingerprint
    };
    
    // Simple hash of fingerprint data
    const str = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', async function() {
    await identifyVisitor();
});

// Identify visitor - FIXED: removed extra 'a'
async function identifyVisitor() {
    try {
        const fingerprint = await getBrowserFingerprint();
        
        const response = await fetch(`${API_URL}/api/identify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fingerprint })
        });
        
        const data = await response.json();
        visitorId = data.visitorId;
        
        // Enable chat inputs once visitor is identified
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        if (chatInput) chatInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
        
        // Update stats display if it exists
        const visitorDisplay = document.getElementById('visitorIdDisplay');
        if (visitorDisplay) visitorDisplay.textContent = visitorId;
        
        // Handle returning visitor
        if (data.isReturning) {
            const welcomeMessage = data.name 
                ? `Welcome back, ${data.name}! How can I help you today?`
                : `Welcome back! I see we've chatted ${data.totalConversations} times before. How can I assist you today?`;
            
            window.returningVisitorMessage = welcomeMessage;
        }
        
        console.log('Visitor identified:', data);
    } catch (error) {
        console.error('Failed to identify visitor:', error);
        // Enable inputs anyway - will use IP-based identification
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        if (chatInput) chatInput.disabled = false;
        if (sendButton) sendButton.disabled = false;
    }
}

let typingTimeout;

function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.textContent = 'Thinking...';
        indicator.style.display = 'block';
    }
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    // Always wait at least 1.5s before hiding
    typingTimeout = setTimeout(() => {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.style.display = 'none';
    }, 1500);
}


// Start chat function (called from index.html)
function startChat() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    conversationActive = true;
    
    // Show conversation stats
    const stats = document.getElementById('conversationStats');
    if (stats) stats.style.display = 'flex';
    
    // Send initial greeting
    const greeting = window.returningVisitorMessage || 
        "Hey, I'm an Agent to help you enhance your business. What challenges are you currently facing?";
    
    addMessage(greeting, 'ai');
    
    // Focus on input
    document.getElementById('chatInput').focus();
}

// Send message function - FIXED: moved messageCount update
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !conversationActive) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    input.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Visitor-ID': visitorId || ''
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        if (data.error) {
            addMessage(`Error: ${data.error}`, 'ai');
        } else {
            addMessage(data.response, 'ai');
            messageCount = data.messageCount || 0;
            
            // Update message count display - MOVED HERE
            const countDisplay = document.getElementById('messageCount');
            if (countDisplay) countDisplay.textContent = messageCount;
            
            // Update visitor ID if not set
            if (!visitorId && data.visitorId) {
                visitorId = data.visitorId;
                const visitorDisplay = document.getElementById('visitorIdDisplay');
                if (visitorDisplay) visitorDisplay.textContent = visitorId;
            }
            
            // Show recommendations if any
            if (data.recommendations && data.recommendations.length > 0) {
                showRecommendations(data.recommendations);
            }
            
            // Check if conversation should end
            if (data.shouldEndConversation) {
                setTimeout(() => {
                    promptForEmail();
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Send message error:', error);
        addMessage('Sorry, I encountered an error. Please try again.', 'ai');
    } finally {
        hideTypingIndicator();
    }
}

// Add message to chat
function addMessage(content, type) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;

    // Only format AI messages, leave user messages plain
    if (type === 'ai') {
        // Convert markdown-style formatting to HTML
        let formattedContent = content
            // Convert bold text **text** or __text__
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            
            // Convert line breaks (double newline for paragraphs)
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            
            // Wrap in paragraph tags
            .replace(/^/, '<p>')
            .replace(/$/, '</p>')
            
            // Convert numbered lists (1. 2. 3. etc)
            .replace(/<p>[\s]*(\d+)\.\s+(.*?)(?=<br>|<\/p>)/g, '<li data-number="$1">$2</li>')
            .replace(/(<li data-number="\d+">.*?<\/li>)(?:<br>)?/g, '$1')
            .replace(/(<li data-number="\d+">.*?<\/li>)+/g, function(match) {
                return '<ol>' + match.replace(/data-number="\d+"/g, '') + '</ol>';
            })
            
            // Convert bullet lists starting with - or *
            .replace(/<p>[\s]*[-*]\s+(.*?)(?=<br>|<\/p>)/g, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)(?:<br>)?/g, '$1')
            .replace(/(<li>(?!.*data-number).*<\/li>)+/g, function(match) {
                return '<ul>' + match + '</ul>';
            })
            
            // Clean up empty paragraphs and fix list formatting
            .replace(/<p><\/p>/g, '')
            .replace(/<p><ul>/g, '<ul>')
            .replace(/<\/ul><\/p>/g, '</ul>')
            .replace(/<p><ol>/g, '<ol>')
            .replace(/<\/ol><\/p>/g, '</ol>')
            // Remove any stray brackets or formatting artifacts
            .replace(/\s*\]\s*/g, ' ');

        
        messageDiv.innerHTML = formattedContent;
    } else {
        // User messages remain plain text
        messageDiv.textContent = content;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show service recommendations
function showRecommendations(recommendations) {
    const messagesContainer = document.getElementById('chatMessages');
    const recDiv = document.createElement('div');
    recDiv.className = 'recommendations';
    recDiv.innerHTML = '<strong>Recommended Services:</strong><ul>' +
        recommendations.map(r => `<li><strong>${r.name}:</strong> ${r.description}</li>`).join('') +
        '</ul>';
    messagesContainer.appendChild(recDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Prompt for email
/*function promptForEmail() {
    const messagesContainer = document.getElementById('chatMessages');
    const emailPrompt = document.createElement('div');
    emailPrompt.className = 'email-prompt';
    emailPrompt.innerHTML = `
        <p>Would you like a summary of our conversation and personalized recommendations?</p>
        <input type="email" id="emailCapture" placeholder="Enter your email" class="email-input-inline">
        <button onclick="submitEmail()" class="email-submit-btn">Send Summary</button>
    `;
    messagesContainer.appendChild(emailPrompt);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    document.getElementById('emailCapture').focus();
}*/

// Submit email
async function submitEmail() {
    const emailInput = document.getElementById('emailCapture');
    const email = emailInput.value.trim();
    
    if (!email || !validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Visitor-ID': visitorId || ''
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            addMessage('Thank you! I\'ve sent a summary to your email. Our team will follow up with you soon.', 'ai');
            emailInput.parentElement.style.display = 'none';
            conversationActive = false;
        } else {
            addMessage('Sorry, there was an error sending the email. Please try again.', 'ai');
        }
    } catch (error) {
        console.error('Email submission error:', error);
        addMessage('Failed to send email. Please try again.', 'ai');
    }
}

// Handle Enter key press
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Typing indicator functions
function showTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.style.display = 'block';
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.style.display = 'none';
}

// Memory panel functions
async function toggleMemory() {
    const panel = document.getElementById('memoryPanel');
    panel.classList.toggle('open');
    
    if (panel.classList.contains('open') && visitorId) {
        try {
            const response = await fetch(`${API_URL}/api/memory`, {
                method: 'GET',
                headers: {
                    'X-Visitor-ID': visitorId
                }
            });
            
            const memory = await response.json();
            updateMemoryDisplay(memory);
        } catch (error) {
            console.error('Failed to load memory:', error);
            document.getElementById('memoryDisplay').innerHTML = 
                '<p style="color: #ff6b6b;">Error loading memory</p>';
        }
    }
}

function updateMemoryDisplay(memory) {
    const display = document.getElementById('memoryDisplay');
    display.innerHTML = `
        <div class="memory-section">
            <h4>Core Memory</h4>
            <pre>${JSON.stringify(memory.core_memory || {}, null, 2)}</pre>
        </div>
        <div class="memory-section">
            <h4>Conversation Summary</h4>
            <pre>${memory.conversation_summary || 'No summary yet'}</pre>
        </div>
        <div class="memory-section">
            <h4>Identified Challenges</h4>
            <pre>${(memory.identified_challenges || []).join('\n') || 'None identified'}</pre>
        </div>
        <div class="memory-section">
            <h4>Statistics</h4>
            <pre>Total Interactions: ${memory.interaction_count || 0}
Last Interaction: ${memory.last_interaction || 'First session'}</pre>
        </div>
    `;
}

// Reset memory
async function resetMemory() {
    if (!confirm('Are you sure you want to reset all memory? This cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/memory`, {
            method: 'DELETE',
            headers: {
                'X-Visitor-ID': visitorId || ''
            }
        });
        
        if (response.ok) {
            addMessage('Memory has been reset. Let\'s start fresh!', 'ai');
            messageCount = 0;
            
            // Update memory display if open
            if (document.getElementById('memoryPanel').classList.contains('open')) {
                updateMemoryDisplay({});
            }
        }
    } catch (error) {
        console.error('Failed to reset memory:', error);
        addMessage('Error resetting memory', 'ai');
    }
}

// Email validation
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Export functions for use in HTML
window.startChat = startChat;
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.toggleMemory = toggleMemory;
window.resetMemory = resetMemory;
window.submitEmail = submitEmail;