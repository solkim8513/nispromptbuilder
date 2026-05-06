# NIS Prompt Builder

A Vercel-ready prompt builder for internal teams. It keeps a three-screen flow:

1. PRD / clarification prompt with company OpenAI.
2. Build instruction prompt with company OpenAI by default, plus optional personal Claude or Gemini keys.
3. Review / red-team prompt with company OpenAI.

## Local Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Set your company OpenAI key in `.env.local`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Do not commit `.env.local`.

## Personal Provider Keys

Claude and Gemini keys are entered in the Provider panel on Screen 2. They are saved in the user's browser local storage only. They are sent to the API route only when that provider is selected, and are not stored server-side.

## Test Commands

```bash
npm test
npm run build
```

## Vercel Deployment

1. Import this GitHub repo into Vercel.
2. Add environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
3. Deploy.

The app uses `/api/generate` so the company OpenAI key stays on the server.
