<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bb36e766-0e20-40da-9b8e-2044756de9b1

## Run Locally

**Prerequisites:** Node.js (recommended: Node 24)


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy (Cloudflare Workers)

This project is set up to deploy Next.js to Cloudflare Workers using OpenNext.

1. Configure your environment variables in Cloudflare (Worker settings) and/or via Wrangler secrets.
2. Build and deploy:
   `npm run deploy`

If you deploy via Cloudflare's Git integration, make sure the repo includes a Wrangler config that Cloudflare can detect.
This repo provides `wrangler.toml` and `wrangler.jsonc` with the required `assets` binding (`ASSETS`) for `/_next/static/*`.
