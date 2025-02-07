const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

let cachedDb = null;
let activePlayers = new Map(); // Хранит активных игроков и время их последней активности

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Initialize storage
async function initializeStorage() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(LEADERBOARD_FILE);
    } catch {
      await fs.writeFile(LEADERBOARD_FILE, '[]');
    }
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
}

// Очистка неактивных игроков каждые 30 секунд
setInterval(() => {
  const now = Date.now();
  for (const [player, lastSeen] of activePlayers.entries()) {
    if (now - lastSeen > 30000) { // Если игрок не отправлял heartbeat более 30 секунд
      activePlayers.delete(player);
    }
  }
}, 30000);

async function connectToDatabase(uri) {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(uri);
  const db = client.db('snake-game');
  cachedDb = db;
  return db;
}

async function loadLeaderboardFromFile() {
  try {
    const data = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

async function saveLeaderboardToFile(leaderboard) {
  await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
}

const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
  'https://game-zmeika.vercel.app',
  'http://localhost:3000',
  'http://localhost:9000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:9000'
];

// Initialize express app for local development
const app = express();

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? error.message : 'An unexpected error occurred'
  });
});

// Request handler
async function handleRequest(req, res) {
  try {
    if (req.url.endsWith('/heartbeat')) {
      const { username } = req.body || {};
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }
      
      try {
        activePlayers.set(username, Date.now());
        return res.json({ activePlayers: activePlayers.size });
      } catch (err) {
        console.error('Heartbeat error:', err);
        return res.status(500).json({ error: 'Failed to process heartbeat' });
      }
    }

    if (req.url.endsWith('/leave')) {
      const { username } = req.body || {};
      if (username) {
        activePlayers.delete(username);
      }
      return res.json({ activePlayers: activePlayers.size });
    }

    const useFileStorage = !process.env.MONGODB_URI;

    if (useFileStorage) {
      if (req.method === 'GET') {
        const leaderboard = await loadLeaderboardFromFile();
        return res.json({ scores: leaderboard, activePlayers: activePlayers.size });
      } else if (req.method === 'POST') {
        const { username, score } = req.body || {};
        if (!username || typeof score !== 'number') {
          return res.status(400).json({ error: 'Invalid data' });
        }

        let leaderboard = await loadLeaderboardFromFile();
        const existingIndex = leaderboard.findIndex(entry => entry.username === username);

        if (existingIndex !== -1) {
          if (score > leaderboard[existingIndex].score) {
            leaderboard[existingIndex] = { username, score, date: new Date().toISOString() };
          }
        } else {
          leaderboard.push({ username, score, date: new Date().toISOString() });
        }

        leaderboard.sort((a, b) => b.score - a.score);
        leaderboard = leaderboard.slice(0, 100);

        await saveLeaderboardToFile(leaderboard);
        const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
        return res.json({ rank, leaderboard, activePlayers: activePlayers.size });
      }
    } else {
      const db = await connectToDatabase(process.env.MONGODB_URI);
      const collection = db.collection('leaderboard');

      if (req.method === 'GET') {
        const leaderboard = await collection.find({}).sort({ score: -1 }).limit(100).toArray();
        return res.json({ scores: leaderboard, activePlayers: activePlayers.size });
      } else if (req.method === 'POST') {
        const { username, score } = req.body || {};
        if (!username || typeof score !== 'number') {
          return res.status(400).json({ error: 'Invalid data' });
        }

        const existingPlayer = await collection.findOne({ username });

        if (existingPlayer) {
          if (score > existingPlayer.score) {
            await collection.updateOne({ username }, { $set: { score, date: new Date().toISOString() } });
          }
        } else {
          await collection.insertOne({ username, score, date: new Date().toISOString() });
        }

        const leaderboard = await collection.find({}).sort({ score: -1 }).limit(100).toArray();
        const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
        return res.json({ rank, leaderboard, activePlayers: activePlayers.size });
      }
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Request handler error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: isDev ? error.message : 'An unexpected error occurred'
    });
  }
}

// Initialize storage on startup
initializeStorage();

// Export handler for serverless environment
module.exports = handleRequest;

// Start local server if running directly
if (require.main === module) {
  app.all('*', handleRequest);
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Local API server running on port ${PORT}`);
  });
} 