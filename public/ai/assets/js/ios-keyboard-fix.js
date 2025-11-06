// iOS Keyboard Viewport Fix
(function() {
    // Detect if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (!isIOS) return; // Only run on iOS devices
    
    // Get elements
    const chatContainer = document.querySelector('.chat-container');
    const chatInput = document.querySelector('.chat-input');
    const chatMessages = document.querySelector('.chat-messages');
    const inputContainer = document.querySelector('.chat-input-container');
    
    if (!chatContainer || !chatInput) return;
    
    // Store the initial viewport height
    let initialHeight = window.innerHeight;
    let keyboardHeight = 0;
    
    // Function to handle viewport changes
    function handleViewportChange() {
        const currentHeight = window.innerHeight;
        keyboardHeight = initialHeight - currentHeight;
        
        if (keyboardHeight > 50) { // Keyboard is likely open
            // Adjust container height to visible viewport
            chatContainer.style.height = `${currentHeight}px`;
            chatContainer.style.maxHeight = `${currentHeight}px`;
            
            // Ensure input stays visible
            if (inputContainer) {
                inputContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        } else { // Keyboard is closed
            // Reset to full height
            chatContainer.style.height = '100%';
            chatContainer.style.maxHeight = '100%';
        }
    }
    
    // Alternative approach using Visual Viewport API (if available)
    if ('visualViewport' in window) {
        const viewport = window.visualViewport;
        
        function updateViewport() {
            const offsetTop = viewport.offsetTop;
            const height = viewport.height;
            
            // Adjust container to match visual viewport
            chatContainer.style.height = `${height}px`;
            chatContainer.style.transform = `translateY(${offsetTop}px)`;
            
            // Debug logging (remove in production)
            console.log('Visual viewport height:', height, 'Offset:', offsetTop);
        }
        
        viewport.addEventListener('resize', updateViewport);
        viewport.addEventListener('scroll', updateViewport);
    } else {
        // Fallback for older iOS versions
        window.addEventListener('resize', handleViewportChange);
    }
    
    // Handle input focus/blur
    chatInput.addEventListener('focus', function() {
        // Small delay to let keyboard fully appear
        setTimeout(() => {
            // Force the input to stay in view
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Additional adjustment for iOS
            if (chatContainer.classList.contains('active')) {
                const currentHeight = window.innerHeight;
                chatContainer.style.height = `${currentHeight}px`;
            }
        }, 300);
    });
    
    chatInput.addEventListener('blur', function() {
        // Reset when keyboard closes
        setTimeout(() => {
            chatContainer.style.height = '100%';
            chatContainer.style.transform = '';
        }, 300);
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
        setTimeout(() => {
            initialHeight = window.innerHeight;
            handleViewportChange();
        }, 500);
    });
    
    // Initial setup
    handleViewportChange();
})();