# UGC Brief Command Center — Intake Breathing

AI-powered UGC brief generator for the Intake Breathing marketing team. Fill in product, audience, and campaign details — get a complete creator-ready brief in seconds.

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub Repo
3. Select this repo — Railway auto-detects and builds it
4. Once deployed, open the URL and go to ⚙ Settings
5. Paste your Anthropic API key (`sk-ant-...`) and click Save & Test

## Local Development

```bash
npm install
npm run dev
```

Opens at http://localhost:3000

## How It Works

- **✦ AI Generate** — Sends brief data to Claude Sonnet API, returns original creative content (hooks, story beats, persona, overlay ideas). Requires Anthropic API key (~$0.01-0.02 per brief).
- **⚡ Instant Draft** — Uses built-in templates with Intake's playbook. No API key needed. Fast but generic.

## API Key

Get your key from [console.anthropic.com](https://console.anthropic.com) → API Keys. The key is stored in the browser's localStorage — it never touches your server.

## Tech Stack

- Vite + React 18
- Anthropic Claude Sonnet API (client-side)
- localStorage for persistence
- No database needed
