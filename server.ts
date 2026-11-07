import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const port = 3000;

  app.use(express.json());

  // Webhook dispatch endpoint with accurate delivery verification
  app.post('/api/booking-webhook', async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const prodUrl = process.env.VITE_BOOKING_WEBHOOK_URL || 'https://foamy-foxhound.pikapod.net/webhook/galaxy-booking';
      const testUrl = process.env.VITE_BOOKING_WEBHOOK_TEST_URL || 'https://foamy-foxhound.pikapod.net/webhook-test/galaxy-booking';
      const targets = Array.from(new Set([prodUrl, testUrl].filter(Boolean)));

      let delivered = false;
      let lastStatus = 0;

      for (const url of targets) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(6000)
          });
          lastStatus = response.status;
          if (response.ok) {
            delivered = true;
            break;
          }
        } catch (err) {
          console.warn('Webhook delivery attempt error to', url, err);
        }
      }

      res.status(200).json({ success: delivered, status: lastStatus });
    } catch (error) {
      console.error('Server webhook endpoint error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
