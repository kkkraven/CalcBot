import express from 'express';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

const app = express();
app.use(express.json());

const API_BASE = 'https://generativelanguage.googleapis.com';

app.all('/api-proxy/*', async (req, res) => {
  const targetPath = req.originalUrl.replace('/api-proxy', '');
  const url = `${API_BASE}${targetPath}?key=${API_KEY}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    res.status(response.status);
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
