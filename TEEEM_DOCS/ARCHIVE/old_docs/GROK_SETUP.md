# Grok AI Integration Setup

Your TEEEM application now includes Grok AI for real-time team collaboration!

## Features

- **Context-Aware Chat**: Grok knows what page you're on and what you're working on
- **Feature Suggestions**: Ask Grok to suggest next features based on your current app structure
- **Team Planning**: Discuss architecture, debug issues, and plan sprints with AI assistance
- **Floating Chat Button**: Always accessible from bottom-right corner

## Setup Instructions

### 1. Get Your xAI API Key

1. Go to [console.x.ai](https://console.x.ai)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key (you get $25 free credits per month!)

### 2. Configure Environment Variables

#### Local Development

Add to `/backend/.env`:
```bash
XAI_API_KEY=your_api_key_here
```

#### Production (Heroku)

```bash
heroku config:set XAI_API_KEY=your_api_key_here -a teeemlive
```

### 3. Restart Your Servers

**Backend:**
```bash
cd backend
bin/rails server -p 3001
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## Usage

### Opening the Chat

Click the floating sparkle icon (✨) in the bottom-right corner of any page.

### Quick Actions

- **Suggest Features**: Click the "Suggest Features" button to get AI-powered feature recommendations
- **Ask Anything**: Type your question about architecture, bugs, or next steps

### Context Sharing

Grok automatically sees:
- Current page you're on
- Table you're editing (if applicable)
- Your role and permissions

### Example Prompts

- "What features should we build next for this table?"
- "How should we structure the database for multi-tenancy?"
- "Help me debug why the API is returning 401"
- "Create a sprint plan for the next 2 weeks"
- "What's the best way to implement real-time updates?"

## API Endpoints

### POST /api/v1/grok/chat
Send a message to Grok with context.

**Request:**
```json
{
  "message": "What features should we build next?",
  "context": {
    "current_page": "/designer",
    "current_table": {
      "name": "customers",
      "columns": 5
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "Based on your customers table...",
  "model": "grok-beta",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200
  }
}
```

### GET /api/v1/grok/suggest-features
Get AI-powered feature suggestions.

**Query Parameters:**
- `table_id` (optional): Focus suggestions on a specific table

## Troubleshooting

### "Failed to connect to Grok"
- Check your API key is set correctly in environment variables
- Verify you have available credits at console.x.ai
- Ensure backend server is running

### Chat not appearing
- Check browser console for errors
- Verify frontend is connecting to backend API
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

## Cost Management

- Free tier: $25/month in credits
- Typical message: ~$0.01
- Monitor usage at console.x.ai
- Set spending limits in xAI console

## Future Enhancements

Planned features:
- [ ] Real-time team chat (multiple users see same conversation)
- [ ] Code generation from Grok suggestions
- [ ] Automatic feature ticket creation
- [ ] Integration with project management tools
- [ ] Voice input support

## Support

For issues or questions:
- Check the xAI docs: [docs.x.ai](https://docs.x.ai)
- Open an issue in your repo
- Ask Grok itself! (it's pretty helpful)
