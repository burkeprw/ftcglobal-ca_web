function handleEmailSentSuccessfully() {
    /**
     * Called when sendPersonalizedEmail() completes successfully.
     * Hides the search bar/input container and marks conversation as ended.
     */
    console.log('[CHAT] Email sent successfully - hiding input');
    
    const inputContainer = document.querySelector('.chat-input-container');
    const chatInput = document.querySelector('.chat-input');
    const sendButton = document.querySelector('.send-button');
    
    if (inputContainer) {
        // Hide the input
        inputContainer.classList.add('email-sent');
        
        // Disable inputs (backup)
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = '';
        }
        if (sendButton) {
            sendButton.disabled = true;
        }
        
        // Scroll to bottom
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }
        
        console.log('[CHAT] Input container hidden - conversation ended');
    }
}
