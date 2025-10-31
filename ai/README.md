# AI Consulting Lead Generator

An intelligent chatbot that engages visitors, identifies business challenges, and captures leads for consulting services. Built on Cloudflare Pages with edge computing capabilities.

## 🎯 Features

- **Visitor Intelligence**: Automatically identifies visitor location and recognizes returning users
- **AI-Powered Conversations**: Uses Claude API for natural, context-aware conversations
- **Persistent Memory**: Remembers previous interactions with returning visitors
- **Service Matching**: Recommends relevant consulting services based on conversation
- **Automated Email Follow-up**: Sends conversation summaries to both visitor and host
- **Rate Limiting**: 5-round conversation limit with token management
- **Edge Computing**: Runs globally on Cloudflare's network for low latency

## 🏗️ Architecture
```
┌─────────────────────────────────────────┐
│     Static Frontend (Cloudflare Pages)   │
│  • Landing page with email capture       │
│  • Real-time chat interface              │
│  • Memory state visualization            │
└───────────────┬─────────────────────────┘
                │ API Calls
                ▼
┌─────────────────────────────────────────┐
│    Cloudflare Worker (Edge Functions)    │
│  • Claude API integration                │
│  • Visitor identification & tracking     │
│  • Conversation management               │
│  • Email routing                         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      Cloudflare D1 (SQL Database)        │
│  • Visitor profiles & history            │
│  • Conversation logs                     │
│  • Services catalog                      │
│  • Memory persistence                    │
└─────────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Cloudflare Workers (JavaScript)
- **Database**: Cloudflare D1 (SQLite)
- **AI**: Anthropic Claude API
- **Email**: Cloudflare Email Routing
- **Hosting**: Cloudflare Pages
- **Development**: Wrangler CLI

## 📁 Project Structure
```
my-ai-agent/
├── public/                 # Static assets
│   ├── index.html         # Landing page & chat UI
│   └── assets/
│       ├── css/
│       │   └── main.css   # Dark theme styles
│       └── js/
│           └── chat.js    # Frontend chat logic
├── functions/             # Cloudflare Worker endpoints
│   └── api/
│       ├── chat.js       # Chat endpoint
│       ├── identify.js   # Visitor identification
│       ├── email.js      # Email sending
│       └── services.js   # Service recommendations
├── src/
│   ├── lib/
│   │   ├── ai-agent.js  # Claude integration & memory
│   │   ├── database.js  # D1 database queries
│   │   └── email.js     # Email utilities
│   └── index.js          # Main Worker entry
├── schema/
│   └── database.sql      # D1 database schema
├── wrangler.jsonc        # Cloudflare configuration
├── package.json          # Dependencies
└── README.md             
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm (can be installed via conda)
- Cloudflare account
- Anthropic API key for Claude

### Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd my-ai-agent

# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create ai-agent-db

# Update wrangler.toml with your database ID
# Run database migrations
wrangler d1 execute ai-agent-db --file=./schema/database.sql

# Set up environment variables
wrangler secret put CLAUDE_API_KEY
# Enter your Anthropic API key when prompted

wrangler secret put HOST_EMAIL
# Enter the email where you want to receive leads
```

### Development
```bash
# Run locally with hot reload
wrangler pages dev --local --persist

# View at http://localhost:8788
```

### Testing Locally

1. Open http://localhost:8788
2. Click "Begin Conversation"
3. Test visitor identification
4. Have a conversation about business challenges
5. Provide email for follow-up
6. Check email delivery

## 🔧 Configuration

### Environment Variables

Set these in Cloudflare Dashboard or via Wrangler:
```bash
CLAUDE_API_KEY=sk-ant-...        # Anthropic API key
HOST_EMAIL=you@company.com       # Where to send lead notifications
EMAIL_FROM=agent@yourdomain.com  # Sender email address
```

### Database Schema

The D1 database includes three main tables:
- `visitors` - Stores visitor profiles, location, and memory state
- `conversations` - Logs all interactions with transcripts and summaries
- `services` - Catalog of consulting services for AI matching

### Conversation Limits

Edit these in `src/lib/ai-agent.js`:
```javascript
const MAX_ROUNDS = 5;           // Maximum conversation turns
const MAX_TOKENS_PER_MESSAGE = 500;  // Token limit per message
const MAX_TOTAL_TOKENS = 3000;      // Total conversation token limit
```

## 📦 Deployment

### Automatic Deployment (Recommended)

1. Push to GitHub main branch
2. Connect GitHub repo to Cloudflare Pages
3. Set environment variables in Cloudflare Dashboard
4. Automatic deployment on every push

### Manual Deployment
```bash
# Deploy to Cloudflare Pages
wrangler pages deploy

# Deploy database migrations
wrangler d1 execute ai-agent-db --file=./schema/database.sql --remote
```

## 📊 Features in Detail

### Visitor Identification
- Uses Cloudflare headers (`CF-Connecting-IP`, `CF-IPCountry`)
- Stores visitor profile in D1 database
- Recognizes returning visitors by IP + browser fingerprint

### Memory System
- MemGPT-style editable memory
- Persists across conversations
- Stores user preferences, context, and relationship status

### Service Matching
- AI analyzes conversation for business challenges
- Matches against services catalog in database
- Provides relevant recommendations

### Email System
- Dual recipient (visitor + host)
- Markdown-formatted conversation summary
- Sent via Cloudflare Email Routing

## 🐛 Troubleshooting

### Common Issues

**Worker not responding locally**
```bash
# Ensure D1 database is created
wrangler d1 list

# Check Worker logs
wrangler tail
```

**Email not sending**
- Verify email routing is configured in Cloudflare Dashboard
- Check EMAIL_FROM domain is verified

**Claude API errors**
- Verify API key is set: `wrangler secret list`
- Check API rate limits

## 📝 License

[Your License]

## 🤝 Support

For issues or questions, contact: [info@ftcglobal.io]


# ADDITIONAL FUNCTIONALISTY TO CONSIDER
- **Self-Editing Memory**: The AI can update its own memory based on conversations
- **Memory Viewer**: Real-time view of the agent's memory state
- **Memory Reset**: Option to clear all stored memories

## Model Recommendation
This implementation uses **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) for the following reasons:
**Cost-Effective**: ~10x cheaper than Sonnet, ~50x cheaper than Opus
**Fast Response Times**: Ideal for real-time chat interactions
**Sufficient Capability**: Handles conversation and memory management well
**Token Efficiency**: Perfect for frequent API calls with memory context


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
