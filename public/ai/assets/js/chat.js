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
        // Ensure landing page is visible and chat is hidden on load
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chatContainer');
    
    if (landingPage) landingPage.style.display = 'block';
    if (chatContainer) {
        chatContainer.style.display = 'none';
        chatContainer.classList.remove('active');
    }
    
    await identifyVisitor();
    handleIOSKeyboard();
});

// iOS keyboard handling. Supports visualViewport API + fallbacks for older iOS
function handleIOSKeyboard() {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS) return; // Only run on iOS
    
    // Get elements - supports both ID and class selectors
    const chatContainer = document.getElementById('chatContainer') || document.querySelector('.chat-container');
    const chatInput = document.getElementById('chatInput') || document.querySelector('.chat-input');
    const chatMessages = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
    const inputContainer = document.querySelector('.chat-input-container');
    
    if (!chatContainer || !chatInput) {
        console.warn('[iOS] Required elements not found');
        return;
    }
    
    console.log('[iOS] Initializing enhanced keyboard handling');
    
    // Track viewport state
    let initialHeight = window.innerHeight;
    let keyboardHeight = 0;
    
    // Main height update function
    const updateHeight = () => {
        if (chatContainer.style.display === 'none') return;
        
        const currentHeight = window.innerHeight;
        keyboardHeight = initialHeight - currentHeight;
        
        // Keyboard is open (height difference > 50px)
        if (keyboardHeight > 50) {
            console.log('[iOS] Keyboard detected. Height:', currentHeight, 'px');
            
            // Method 1: visualViewport API (best - iOS 13+)
            if (window.visualViewport) {
                chatContainer.style.height = `${window.visualViewport.height}px`;
                chatContainer.style.maxHeight = `${window.visualViewport.height}px`;
                chatContainer.style.transform = `translateY(${window.visualViewport.offsetTop}px)`;
            } else {
                // Fallback: use window.innerHeight
                chatContainer.style.height = `${currentHeight}px`;
                chatContainer.style.maxHeight = `${currentHeight}px`;
            }
            
            // Scroll input into view smoothly
            if (inputContainer) {
                inputContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
            
            // Scroll messages to bottom
            if (chatMessages) {
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 100);
            }
        } 
        // Keyboard is closed
        else {
            console.log('[iOS] Keyboard closed. Resetting height.');
            
            // Reset to full height
            chatContainer.style.height = '100%';
            chatContainer.style.maxHeight = '100%';
            chatContainer.style.transform = '';
        }
    };
    
    // Visual viewport handler (modern approach)
    if (window.visualViewport) {
        const updateViewportInfo = () => {
            const offsetTop = window.visualViewport.offsetTop;
            const height = window.visualViewport.height;
            
            if (height < initialHeight - 50) { // Keyboard open
                chatContainer.style.height = `${height}px`;
                chatContainer.style.maxHeight = `${height}px`;
                chatContainer.style.transform = `translateY(${offsetTop}px)`;
            }
        };
        
        window.visualViewport.addEventListener('resize', updateViewportInfo);
        window.visualViewport.addEventListener('scroll', updateViewportInfo);
    }
    
    // Input focus handler
    chatInput.addEventListener('focus', function() {
        console.log('[iOS] Input focused');
        
        setTimeout(() => {
            updateHeight();
            this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 300);
    });
    
    // Input blur handler (keyboard closing)
    chatInput.addEventListener('blur', function() {
        console.log('[iOS] Input blurred - keyboard closing');
        
        setTimeout(() => {
            updateHeight();
            chatContainer.style.transform = '';
        }, 300);
    });
    
    // Window resize handler (fallback)
    window.addEventListener('resize', updateHeight);
    
    // Orientation change handler (critical for iPad!)
    window.addEventListener('orientationchange', function() {
        console.log('[iOS] Orientation changed');
        
        setTimeout(() => {
            initialHeight = window.innerHeight;
            updateHeight();
        }, 500);
    });
    
    // Prevent viewport bounce
    document.body.addEventListener('touchmove', (e) => {
        if (chatContainer && chatContainer.style.display !== 'none') {
            if (chatMessages && !chatMessages.contains(e.target)) {
                e.preventDefault();
            }
        }
    }, { passive: false });
    
    // Initial setup
    console.log('[iOS] Setting initial height:', initialHeight, 'px');
    updateHeight();
}


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

// let typingTimeout;
/*
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
*/

// Start chat function (called from index.html)
function startChat() {
    const landingPage = document.getElementById('landingPage');
    const chatContainer = document.getElementById('chatContainer');
    
    if (landingPage) landingPage.style.display = 'none';
    if (chatContainer) {
        chatContainer.style.display = 'flex';
        
        // Trigger height update for iOS
        if (window.visualViewport && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
            chatContainer.style.height = `${window.visualViewport.height}px`;
        }
    }
    
    conversationActive = true;
    
    // Show conversation stats
    const stats = document.getElementById('conversationStats');
    if (stats) stats.style.display = 'flex';
    
    // Send initial greeting
    const greeting = window.returningVisitorMessage || 
        "Hey, I'm <strong>eXIQ</strong>, an Agent who can help you enhance your business. What challenges is your business currently facing?";
    
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

       // console.log('[CHAT] API Response:', data);
       // console.log('[CHAT] emailSent flag:', data.emailSent);
       // console.log('[CHAT] shouldEndConversation flag:', data.shouldEndConversation);

        // Check if email was sent
        if (data.emailSent === true || data.shouldEndConversation === true || data.conversationEnded === true) {
          //  addMessage(data.response, 'assistant');
            
            handleEmailSentSuccessfully();         
        }
        
        if (data.error) {
            addMessage(`Error: ${data.error}`, 'ai');
        } else {
            addMessage(data.response, 'ai');
            messageCount = data.messageCount || 0;
            
            const countDisplay = document.getElementById('messageCount');
            if (countDisplay) countDisplay.textContent = messageCount;
            
            // Update visitor ID if not set
            if (!visitorId && data.visitorId) {
                visitorId = data.visitorId;
                const visitorDisplay = document.getElementById('visitorIdDisplay');
                if (visitorDisplay) visitorDisplay.textContent = visitorId;
            }
            
           /* // Show recommendations if any
            if (data.recommendations && data.recommendations.length > 0) {
                showRecommendations(data.recommendations);
            }*/
            
            // Check if conversation should end
            if (data.shouldEndConversation) {
                setTimeout(() => {
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
        messageDiv.textContent = content;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show service recommendations
/*function showRecommendations(recommendations) {
    const messagesContainer = document.getElementById('chatMessages');
    const recDiv = document.createElement('div');
    recDiv.className = 'recommendations';
    recDiv.innerHTML = '<strong>Recommended Services:</strong><ul>' +
        recommendations.map(r => `<li><strong>${r.name}:</strong> ${r.description}</li>`).join('') +
        '</ul>';
    messagesContainer.appendChild(recDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}*/

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
            addMessage('Memory has been reset. Let\'s start fresh! \n\nI\'m <strong>eXIQ</strong>, an Agent who can help you enhance your business. What challenges is your business currently facing?', 'ai');
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

// Enhanced email sent handler that ensures conversation ends
function handleEmailSentSuccessfully() {
    console.log('[CHAT] Email sent successfully - triggering full conversation end');
    
    // Call the main conversation end handler
    handleConversationEnd();
    
    // Additional cleanup specific to email sent
    const inputContainer = document.querySelector('.chat-input-container');
    if (inputContainer) {
        // Nuclear option: remove from DOM entirely after a delay
        setTimeout(() => {
            inputContainer.remove();
            console.log('[CHAT] Input container removed from DOM');
        }, 500);
    }
}

// Main function to handle conversation end after email is sent
function handleConversationEnd() {
   // console.log('[CHAT] Starting conversation end sequence...');
    
    // Method 1: Hide input container using multiple approaches for reliability
    const inputContainer = document.querySelector('.chat-input-container');
    if (inputContainer) {
        // Use setAttribute for highest specificity
     //   inputContainer.setAttribute('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important; height: 0 !important; overflow: hidden !important;');
        
        // Also add multiple classes for CSS fallback
      //  inputContainer.classList.add('email-sent', 'hidden', 'conversation-ended');
        
        // Remove from DOM flow completely
        inputContainer.style.position = 'absolute';
        inputContainer.style.left = '-9999px';
        
        console.log('[CHAT] Input container hidden with DOM methods');
    } else {
        console.error('[CHAT] CRITICAL: Input container not found!');
    }
    
   // Method 2: Create and inject the end container if it doesn't exist
    let endContainer = document.querySelector('.conversation-end-container');
    
    if (!endContainer) {
        console.log('[CHAT] End container not found, creating it...');
        
        // Create the end container dynamically
        endContainer = document.createElement('div');
        endContainer.className = 'conversation-end-container';
        endContainer.innerHTML = `
            <button class="close-button" onclick="showThankYouAndClose()">
                Close Agent
            </button>
        `;
        
        // Insert it where the input container was
        const chatContainer = document.querySelector('.chat-container') || document.querySelector('#chatContainer');
        if (chatContainer) {
            chatContainer.appendChild(endContainer);
        } else {
            console.error('[CHAT] Chat container not found!');
            document.body.appendChild(endContainer);
        }
    }

    // Show the end container with multiple methods
    endContainer.style.display = 'flex';
    endContainer.style.visibility = 'visible';
    endContainer.style.opacity = '1';
    endContainer.classList.remove('hidden');
    endContainer.classList.add('visible', 'active');
    
    // Ensure it's visible by removing any hiding styles
    endContainer.removeAttribute('hidden');
    endContainer.style.removeProperty('display');
    endContainer.style.display = 'flex'; // Re-apply flex
    
 /*  // Method 3: Disable all inputs as backup
    const chatInput = document.querySelector('.chat-input');
    const sendButton = document.querySelector('.send-button');
    
    if (chatInput) {
        chatInput.disabled = true;
        chatInput.style.display = 'none';
        chatInput.value = '';
        console.log('[CHAT] Chat input disabled and hidden');
    }
    
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.style.display = 'none';
        console.log('[CHAT] Send button disabled and hidden');
    }
    
    // Method 4: Scroll to show the end container
    setTimeout(() => {
        if (endContainer) {
            endContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'end',
                inline: 'nearest' 
            });
            
            // Also try to scroll the chat messages area
            const chatMessages = document.querySelector('.chat-messages');
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
        console.log('[CHAT] Scrolled to end container');
    }, 100); */
    
    // Method 5: Add a final message to chat
    // addSystemMessage("📧 Email sent! Our conversation has ended. Patrick from FTC Global will be in touch soon.");
    
    // Log final state for debugging
    console.log('[CHAT] Conversation end sequence complete');
    console.log('[CHAT] Input container display:', inputContainer?.style.display);
    console.log('[CHAT] End container display:', endContainer?.style.display);
    
    // Set a flag to prevent any further interactions
    window.conversationEnded = true;
}

/*// Helper function to add system messages
function addSystemMessage(text) {
    const messagesContainer = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
    if (messagesContainer) {
        const systemMsg = document.createElement('div');
        systemMsg.className = 'message system-message';
        systemMsg.style.cssText = 'text-align: center; color: #8b7aa8; font-style: italic; padding: 1rem; background: rgba(139, 122, 168, 0.1); border-radius: 8px; margin: 1rem 0;';
        systemMsg.textContent = text;
        messagesContainer.appendChild(systemMsg);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}*/

// Show thank you modal and close/redirect
function showThankYouAndClose() {
    console.log('[CHAT] Starting thank you and close sequence...');
    
    // Method 1: Find or create the modal
    let modal = document.querySelector('.thank-you-modal');
    
    if (!modal) {
        console.log('[CHAT] Modal not found, creating it...');
        
        // Create modal dynamically
        modal = document.createElement('div');
        modal.className = 'thank-you-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p>We'll be in touch soon!</p>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Method 2: Show modal with multiple approaches
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.classList.add('visible', 'active', 'show');
    modal.classList.remove('hidden');
    
    // Force high z-index to ensure it's on top
    modal.style.zIndex = '999999';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    
    console.log('[CHAT] Thank you modal displayed');
    
    // Method 3: Handle window closing/redirect
    setTimeout(() => {
        console.log('[CHAT] Attempting to close or redirect...');
        
        // Try multiple close methods
        try {
            // Method 1: Standard close
            if (window.close) {
                window.close();
            }
            
            // Method 2: Self close
            if (self.close) {
                self.close();
            }
            
            // Method 3: Opener close (if opened from another window)
            if (window.opener && !window.opener.closed) {
                window.opener.focus();
                window.close();
            }
        } catch (e) {
            console.log('[CHAT] Cannot close window:', e);
        }
        
        // Fallback: Always redirect after trying to close
        setTimeout(() => {
            console.log('[CHAT] Redirecting to main site...');
            
            // Hide modal before redirect
            if (modal) {
                modal.innerHTML = '<div class="modal-content"><h2>Redirecting...</h2></div>';
            }
            
            // Multiple redirect methods for compatibility
            try {
                window.location.href = 'https://ftcglobal.ca';
            } catch (e) {
                window.location = 'https://ftcglobal.ca';
            }
        }, 500);
    }, 2000);
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
window.showThankYouAndClose = showThankYouAndClose;  
window.handleConversationEnd = handleConversationEnd;
window.handleEmailSentSuccessfully = handleEmailSentSuccessfully;
window.debugConversationEnd = debugConversationEnd;

// Also export to global scope for onclick handlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        handleConversationEnd,
        showThankYouAndClose,
        handleEmailSentSuccessfully,
        debugConversationEnd
    };
}


// Debug function to test the flow
function debugConversationEnd() {
    console.log('=== DEBUGGING CONVERSATION END ===');
    console.log('Input container:', document.querySelector('.chat-input-container'));
    console.log('End container:', document.querySelector('.conversation-end-container'));
    console.log('Thank you modal:', document.querySelector('.thank-you-modal'));
    console.log('Chat container:', document.querySelector('.chat-container'));
    
    // Test the flow
    console.log('Testing handleConversationEnd...');
    handleConversationEnd();
    
    setTimeout(() => {
        console.log('Testing showThankYouAndClose...');
        showThankYouAndClose();
    }, 3000);
}
