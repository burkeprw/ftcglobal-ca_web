"""
MemGPT-style Agent with Self-Editing Memory
Flask version for local testing
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import anthropic
import json
import os
from datetime import datetime
import re
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

app = Flask(__name__)
CORS(app)

CLAUDE_API_KEY = os.getenv('CLAUDE_API_KEY', 'YOUR_API_KEY_HERE')
if CLAUDE_API_KEY == 'YOUR_API_KEY_HERE':
    print("⚠️  WARNING: No API key found! Please set CLAUDE_API_KEY in .env file or app.py")

client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
MODEL = "claude-3-5-haiku-20241022"  # Recommended model for simple chatbot: Fast and cost-effective

class MemoryAgent:
    def __init__(self, memory_file="memory.json"):
        self.memory_file = memory_file
        self.load_memory()
        
    def load_memory(self):
        """Load memory from file or initialize if doesn't exist"""
        if os.path.exists(self.memory_file):
            with open(self.memory_file, 'r') as f:
                self.memory = json.load(f)
        else:
            self.memory = {
                "core_memory": {
                    "user_name": "Unknown",
                    "relationship": "New acquaintance",
                    "personality_notes": "",
                    "important_facts": []
                },
                "conversation_summary": "",
                "recent_topics": [],
                "user_preferences": {},
                "interaction_count": 0,
                "last_interaction": None
            }
            self.save_memory()
    
    def save_memory(self):
        """Save memory to file"""
        with open(self.memory_file, 'w') as f:
            json.dump(self.memory, f, indent=2)
    
    def extract_memory_edits(self, response):
        """Extract memory edit commands from the AI's response"""
        # Pattern to find memory edits in format: [MEMORY_UPDATE: key=value]
        pattern = r'\[MEMORY_UPDATE:\s*([^=]+)=([^\]]+)\]'
        matches = re.findall(pattern, response)
        
        # Remove memory commands from visible response
        clean_response = re.sub(pattern, '', response).strip()
        
        return matches, clean_response
    
    def apply_memory_edits(self, edits):
        """Apply the extracted memory edits"""
        for key, value in edits:
            key = key.strip()
            value = value.strip()
            
            # Parse the key path (e.g., "core_memory.user_name")
            keys = key.split('.')
            
            # Navigate to the correct location in memory
            current = self.memory
            for k in keys[:-1]:
                if k not in current:
                    current[k] = {}
                current = current[k]
            
            # Handle different value types
            if value.lower() == 'true':
                value = True
            elif value.lower() == 'false':
                value = False
            elif value.startswith('[') and value.endswith(']'):
                # Handle list append
                if keys[-1] not in current:
                    current[keys[-1]] = []
                if isinstance(current[keys[-1]], list):
                    current[keys[-1]].append(value[1:-1])
                else:
                    current[keys[-1]] = value
            else:
                current[keys[-1]] = value
        
        self.save_memory()
    
    def get_memory_context(self):
        """Format memory for inclusion in prompt"""
        return f"""
=== CURRENT MEMORY STATE ===
Core Memory:
- User Name: {self.memory['core_memory']['user_name']}
- Relationship: {self.memory['core_memory']['relationship']}
- Personality Notes: {self.memory['core_memory']['personality_notes']}
- Important Facts: {', '.join(self.memory['core_memory']['important_facts']) if self.memory['core_memory']['important_facts'] else 'None yet'}

Conversation Summary: {self.memory['conversation_summary'] or 'No previous conversations'}
Recent Topics: {', '.join(self.memory['recent_topics'][-5:]) if self.memory['recent_topics'] else 'None'}
Interaction Count: {self.memory['interaction_count']}
Last Interaction: {self.memory['last_interaction'] or 'First interaction'}

=== MEMORY INSTRUCTIONS ===
You have the ability to update your memory by including special commands in your response.
Use [MEMORY_UPDATE: key=value] to update memory. Examples:
- [MEMORY_UPDATE: core_memory.user_name=John]
- [MEMORY_UPDATE: core_memory.relationship=Close friend]
- [MEMORY_UPDATE: core_memory.important_facts=[Loves hiking]]
- [MEMORY_UPDATE: conversation_summary=Discussed travel plans and favorite destinations]

These commands will be hidden from the user. Update memory when you learn new information about the user.
"""
    
    def chat(self, user_message):
        """Process a chat message and return response"""
        # Update interaction tracking
        self.memory['interaction_count'] += 1
        self.memory['last_interaction'] = datetime.now().isoformat()
        
        # Build the prompt with memory context
        system_prompt = f"""You are a friendly AI assistant with persistent memory across conversations.
You should remember information about the user and reference it naturally in conversation.
Be warm, helpful, and build a relationship over time.

{self.get_memory_context()}

Remember to update your memory when you learn new things about the user!
The memory update commands will be automatically hidden from the user."""
        
        try:
            # Call Claude API
            response = client.messages.create(
                model=MODEL,
                max_tokens=1000,
                temperature=0.7,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_message}
                ]
            )
            
            # Extract the response text
            ai_response = response.content[0].text
            
            # Extract and apply memory edits
            memory_edits, clean_response = self.extract_memory_edits(ai_response)
            if memory_edits:
                self.apply_memory_edits(memory_edits)
            
            # Save updated memory
            self.save_memory()
            
            return clean_response
            
        except Exception as e:
            return f"Error: {str(e)}. Please check your API key."

# Initialize the agent
agent = MemoryAgent()

@app.route('/')
def index():
    """Serve the HTML page"""
    return send_from_directory('.', 'index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """Handle chat messages"""
    data = request.json
    user_message = data.get('message', '')
    
    if not user_message:
        return jsonify({'error': 'No message provided'}), 400
    
    # Get response from agent
    response = agent.chat(user_message)
    
    return jsonify({
        'response': response,
        'memory_state': agent.memory  # Include memory state for debugging
    })

@app.route('/memory', methods=['GET'])
def get_memory():
    """Get current memory state"""
    return jsonify(agent.memory)

@app.route('/reset', methods=['POST'])
def reset_memory():
    """Reset the agent's memory"""
    if os.path.exists(agent.memory_file):
        os.remove(agent.memory_file)
    agent.load_memory()
    return jsonify({'status': 'Memory reset successfully'})

if __name__ == '__main__':
    print("=" * 50)
    print("MemGPT Agent Server Starting...")
    print(f"Using Model: {MODEL}")
    print("=" * 50)
    #print("IMPORTANT: Replace 'YOUR_API_KEY_HERE' with your actual Claude API key")
    #print("Get your key from: https://console.anthropic.com/")
    #print("=" * 50)
    print("Server running on http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
