// Auto-expanding Chat Input
(function() {
    // Get the chat input element
    const chatInput = document.querySelector('.chat-input');
    
    if (!chatInput) return;
    
    // Configuration
    const MIN_HEIGHT = 44; // Minimum height in pixels
    const MAX_HEIGHT = 120; // Maximum height in pixels (about 4-5 lines)
    const LINE_HEIGHT = 24; // Approximate line height
    
    // Store the original height
    const originalHeight = chatInput.style.height || `${MIN_HEIGHT}px`;
    
    // Function to adjust height
    function adjustHeight() {
        // Reset height to auto to get the correct scrollHeight
        this.style.height = 'auto';
        
        // Calculate the new height
        let newHeight = this.scrollHeight;
        
        // Apply min/max constraints
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT));
        
        // Set the new height
        this.style.height = `${newHeight}px`;
        
        // Add or remove scroll if content exceeds max height
        if (this.scrollHeight > MAX_HEIGHT) {
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
        
        // Adjust container padding if needed (optional)
        const container = document.querySelector('.chat-input-container');
        if (container) {
            // Add class for styling adjustments when expanded
            if (newHeight > MIN_HEIGHT) {
                container.classList.add('expanded');
            } else {
                container.classList.remove('expanded');
            }
        }
    }
    
    // Function to reset height (e.g., after sending message)
    function resetHeight() {
        chatInput.style.height = originalHeight;
        chatInput.style.overflowY = 'hidden';
        const container = document.querySelector('.chat-input-container');
        if (container) {
            container.classList.remove('expanded');
        }
    }
    
    // Attach event listeners
    chatInput.addEventListener('input', adjustHeight);
    chatInput.addEventListener('focus', adjustHeight);
    chatInput.addEventListener('paste', function() {
        // Delay to let paste complete
        setTimeout(() => adjustHeight.call(this), 0);
    });
    
    // Reset height when message is sent
    const sendButton = document.querySelector('.send-button');
    if (sendButton) {
        sendButton.addEventListener('click', function() {
            // Delay reset to allow message to be sent first
            setTimeout(resetHeight, 100);
        });
    }
    
    // Also reset on Enter key (if that sends the message)
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            // If Enter sends the message (without Shift)
            setTimeout(resetHeight, 100);
        }
    });
    
    // Handle Shift+Enter for new lines
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.shiftKey) {
            // Allow new line but prevent default only if needed
            // The input will auto-expand with the adjustHeight function
            setTimeout(() => adjustHeight.call(this), 0);
        }
    });
    
    // Initial adjustment in case there's pre-filled text
    adjustHeight.call(chatInput);
    
    // Export functions for external use if needed
    window.chatInputUtils = {
        adjustHeight: () => adjustHeight.call(chatInput),
        resetHeight: resetHeight
    };
})();