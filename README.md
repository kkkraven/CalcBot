# Run and deploy your AI Studio app

This project contains a small React/Vite front‑end and a simple proxy server
used to communicate with Google Gemini.

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local` and set the `GEMINI_API_KEY` to your Gemini API key.
3. Start the proxy server in another terminal:
    `npm run proxy`
4. Run the app for development:
    `npm run dev`

   `npm run dev`

codex/add-license-file-and-reference-in-readme
## License

This project is licensed under the [MIT License](LICENSE).
## Build For Production

1. Build the static files: `npm run build`
2. Serve the contents of `dist/` with any web server **and** run the proxy
   (`npm run proxy`) so that requests to `/api-proxy/` are forwarded to Gemini.
 main
