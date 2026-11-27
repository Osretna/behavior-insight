import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import apiApp from './server/apiApp.js';

const PORT = 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    apiApp.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    apiApp.use(express.static(distPath));
    apiApp.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  apiApp.listen(PORT, '0.0.0.0', () => {
    console.log(`BEHAVIOR INSIGHT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
