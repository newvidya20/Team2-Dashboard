import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeSheets } from './backend/sheets';
import { registerApiRoutes, validateAuthConfiguration } from './backend/routes';
import { startTaskEmailNotifications } from './backend/task-email-notifications';
import { migrateAssistantTaskHistory } from './backend/task-history';

dotenv.config({ path: ['.env.local', '.env'] });
validateAuthConfiguration();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Team 2 Hub API' });
});

registerApiRoutes(app);

app.use('/api', (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API request failed:', error);
  res.status(500).json({ error: 'The server could not complete the request. Please try again.' });
});

if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

await initializeSheets();
await migrateAssistantTaskHistory();
startTaskEmailNotifications();

app.listen(PORT, HOST, () => {
  console.log(`Team 2 Hub server running on ${HOST}:${PORT} (isProduction: ${isProduction})`);
});
