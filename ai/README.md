# MemGPT Agent with Self-Editing Memory

A simple implementation of a memGPT-style conversational AI agent with persistent, self-editing memory using the Claude API.

## Features

- **Persistent Memory**: The agent remembers information across conversations
- **Self-Editing Memory**: The AI can update its own memory based on conversations
- **Minimalist UI**: Clean, modern interface with a single button to start
- **Memory Viewer**: Real-time view of the agent's memory state
- **Memory Reset**: Option to clear all stored memories

## Model Recommendation

This implementation uses **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) for the following reasons:

1. **Cost-Effective**: ~10x cheaper than Sonnet, ~50x cheaper than Opus
2. **Fast Response Times**: Ideal for real-time chat interactions
3. **Sufficient Capability**: Handles conversation and memory management well
4. **Token Efficiency**: Perfect for frequent API calls with memory context

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Get Your Claude API Key

1. Go to https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key

### 3. Configure the API Key

Open `app.py` and replace `YOUR_API_KEY_HERE` with your actual Claude API key:

```python
CLAUDE_API_KEY = "your-actual-api-key-here"
```

### 4. Run the Application

```bash
python app.py
```

The server will start on `http://localhost:5000`

### 5. Open the Application

Open your browser and go to `http://localhost:5000`

## How It Works

### Memory Structure

The agent maintains a JSON-based memory with the following structure:

```json
{
  "core_memory": {
    "user_name": "Name of the user",
    "relationship": "Nature of relationship",
    "personality_notes": "Notes about user's personality",
    "important_facts": ["List of important facts"]
  },
  "conversation_summary": "Summary of past conversations",
  "recent_topics": ["Recent discussion topics"],
  "user_preferences": {},
  "interaction_count": 0,
  "last_interaction": "ISO timestamp"
}
```

### Self-Editing Memory Mechanism

The AI can update its memory using special commands embedded in its responses:

```
[MEMORY_UPDATE: core_memory.user_name=John]
[MEMORY_UPDATE: core_memory.important_facts=[Loves hiking]]
```

These commands are:
- Automatically extracted from the AI's response
- Hidden from the user's view
- Applied to the persistent memory store

### Memory Persistence

- Memory is stored in `memory.json` file
- Automatically saved after each interaction
- Persists between server restarts

## Usage Tips

1. **Start Simple**: Begin with your name and basic information
2. **Build Context**: Share interests, preferences, and important details
3. **Test Memory**: Ask the agent what it remembers about you
4. **View Memory**: Click "View Memory" to see the current memory state
5. **Reset if Needed**: Use "Reset Memory" to start fresh

## API Endpoints

- `GET /`: Serves the HTML interface
- `POST /chat`: Handles chat messages
- `GET /memory`: Returns current memory state
- `POST /reset`: Resets the agent's memory

## Customization

### Changing the Model

To use a different Claude model, modify the `MODEL` variable in `app.py`:

```python
# For more complex tasks:
MODEL = "claude-3-5-sonnet-20241022"  # Better reasoning, higher cost

# For maximum capability:
MODEL = "claude-opus-4-1-20250805"  # Best performance, highest cost
```

### Modifying Memory Structure

Edit the `MemoryAgent.__init__` method to change the default memory structure.

### Customizing UI

The interface uses inline CSS in `index.html` for easy customization.

## Cost Considerations

With Claude 3.5 Haiku:
- Input: $1 per 1M tokens
- Output: $5 per 1M tokens
- Average conversation: ~500-1000 tokens
- Estimated cost: <$0.01 per conversation

## Troubleshooting

1. **"Error: Please check your API key"**: Ensure your API key is correctly set in `app.py`
2. **Connection errors**: Make sure the Flask server is running on port 5000
3. **Memory not persisting**: Check write permissions for `memory.json` file
4. **CORS errors**: Ensure you're accessing via `localhost:5000`, not file://

## Security Notes

- **Never commit your API key** to version control
- Consider using environment variables for the API key in production
- The memory file contains conversation data - handle with appropriate privacy measures

## Future Enhancements

- Add conversation history display
- Implement memory search functionality
- Add export/import memory features
- Create memory categories or tags
- Implement memory importance scoring
- Add multi-user support with separate memory stores
