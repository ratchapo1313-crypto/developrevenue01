import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import {
  INITIAL_REVENUE_CATEGORIES,
  INITIAL_LAND_TAX_DATA,
  INITIAL_SIGN_TAX_DATA,
  INITIAL_MARKET_SUMMARIES,
  INITIAL_MARKET_CONTRACTS,
  INITIAL_DAILY_RECORDS,
  INITIAL_TAXPAYER_RECORDS,
  INITIAL_OLD_TAX_DEBTORS,
} from './src/data/initialData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database directory and file
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

interface AppDatabase {
  categories: any[];
  landTax: any;
  signTax: any;
  taxpayers: any[];
  oldTaxDebtors: any[];
  marketSummaries: any;
  marketContracts: any[];
  dailyRecords: any[];
  updatedAt: string;
  version: number;
}

const getDefaultDatabase = (): AppDatabase => ({
  categories: INITIAL_REVENUE_CATEGORIES,
  landTax: INITIAL_LAND_TAX_DATA,
  signTax: INITIAL_SIGN_TAX_DATA,
  taxpayers: INITIAL_TAXPAYER_RECORDS,
  oldTaxDebtors: INITIAL_OLD_TAX_DEBTORS,
  marketSummaries: INITIAL_MARKET_SUMMARIES,
  marketContracts: INITIAL_MARKET_CONTRACTS,
  dailyRecords: INITIAL_DAILY_RECORDS,
  updatedAt: new Date().toISOString(),
  version: 1,
});

const loadDatabase = (): AppDatabase => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        ...getDefaultDatabase(),
        ...parsed,
      };
    }
  } catch (e) {
    console.error('Failed to load database from file, using defaults', e);
  }

  const initial = getDefaultDatabase();
  saveDatabase(initial);
  return initial;
};

const saveDatabase = (data: AppDatabase): void => {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (e) {
    console.error('Failed to save database to file', e);
  }
};

// In-memory active database
let currentDatabase = loadDatabase();

// Connected clients for real-time Server-Sent Events across all machines
interface SSEClient {
  id: number;
  res: Response;
}
let sseClients: SSEClient[] = [];
let nextClientId = 1;

const broadcastToAllClients = (event: string, payload: any) => {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(data);
    } catch {
      // client disconnected
    }
  });
};

// SSE Heartbeat every 20s
setInterval(() => {
  sseClients.forEach((client) => {
    try {
      client.res.write(': keep-alive\n\n');
    } catch {
      // disconnected
    }
  });
}, 20000);

// --- API ROUTES ---

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    connectedClients: sseClients.length,
    version: currentDatabase.version,
    updatedAt: currentDatabase.updatedAt,
  });
});

// Full database fetch for newly opened machines
app.get('/api/database', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: currentDatabase,
  });
});

// Real-time Server-Sent Events subscription endpoint
app.get('/api/database/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.flushHeaders?.();

  const clientId = nextClientId++;
  sseClients.push({ id: clientId, res });

  // Send initial handshake
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      clientId,
      version: currentDatabase.version,
      updatedAt: currentDatabase.updatedAt,
    })}\n\n`
  );

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Update database endpoint (saves every change and broadcasts to all machines)
app.post('/api/database/update', (req: Request, res: Response) => {
  try {
    const { key, data, sourceId } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Missing key parameter' });
    }

    const validKeys: (keyof AppDatabase)[] = [
      'categories',
      'landTax',
      'signTax',
      'taxpayers',
      'oldTaxDebtors',
      'marketSummaries',
      'marketContracts',
      'dailyRecords',
    ];

    if (!validKeys.includes(key as keyof AppDatabase)) {
      return res.status(400).json({ error: `Invalid key: ${key}` });
    }

    (currentDatabase as any)[key] = data;
    currentDatabase.version = (currentDatabase.version || 0) + 1;
    currentDatabase.updatedAt = new Date().toISOString();

    saveDatabase(currentDatabase);

    // Broadcast to all other computers / devices connected
    broadcastToAllClients('database_updated', {
      key,
      data,
      sourceId,
      version: currentDatabase.version,
      updatedAt: currentDatabase.updatedAt,
    });

    return res.json({
      success: true,
      version: currentDatabase.version,
      updatedAt: currentDatabase.updatedAt,
    });
  } catch (error) {
    console.error('Failed to update database', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset database endpoint
app.post('/api/database/reset', (_req: Request, res: Response) => {
  try {
    currentDatabase = getDefaultDatabase();
    currentDatabase.version = (currentDatabase.version || 0) + 1;
    saveDatabase(currentDatabase);

    broadcastToAllClients('database_reset', {
      data: currentDatabase,
      version: currentDatabase.version,
      updatedAt: currentDatabase.updatedAt,
    });

    return res.json({ success: true, data: currentDatabase });
  } catch (error) {
    console.error('Failed to reset database', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- SERVER SETUP ---

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite middlewares in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
