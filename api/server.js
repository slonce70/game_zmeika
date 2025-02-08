const express = require('express');
const path = require('path');
const getDB = require('./lib/db');

const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = [
  'https://game-zmeika.vercel.app',
  'http://localhost:3000',
  'http://localhost:9000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:9000'
];

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isDev) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? error.message : 'An unexpected error occurred'
  });
});

async function handleRequest(req, res) {
  try {
    const db = await getDB();
    const collection = db.collection('leaderboard');
    const now = new Date();
    const thirtySecAgo = new Date(Date.now() - 30000);

    if (req.url.endsWith('/heartbeat')) {
      const { username } = req.body || {};
      if (!username) return res.status(400).json({ error: 'Username is required' });
      await collection.updateOne({ username }, { $set: { lastActive: now } }, { upsert: true });
      const activeCount = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
      return res.json({ activePlayers: activeCount });
    }

    if (req.url.endsWith('/leave')) {
      const { username } = req.body || {};
      if (username) await collection.updateOne({ username }, { $set: { lastActive: new Date(0) } });
      const activeCount = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
      return res.json({ activePlayers: activeCount });
    }

    if (req.method === 'GET') {
      const leaderboard = await collection.find({}).sort({ score: -1 }).limit(10).toArray();
      const activeCount = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
      return res.json({ scores: leaderboard, activePlayers: activeCount });
    }

    if (req.method === 'POST') {
      const { username, score } = req.body || {};
      if (!username || typeof score !== 'number') return res.status(400).json({ error: 'Invalid data' });
      const existingPlayer = await collection.findOne({ username });
      if (existingPlayer) {
        const updateDoc = { $set: { lastActive: now } };
        if (score > existingPlayer.score) {
          updateDoc.$set.score = score;
          updateDoc.$set.date = now.toISOString();
        }
        await collection.updateOne({ username }, updateDoc);
      } else {
        await collection.insertOne({ username, score, date: now.toISOString(), lastActive: now });
      }
      const leaderboard = await collection.find({}).sort({ score: -1 }).limit(10).toArray();
      const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
      const activeCount = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
      return res.json({ rank, leaderboard, activePlayers: activeCount });
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

module.exports = handleRequest;

if (require.main === module) {
  app.all('*', handleRequest);
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Local API server running on port ${PORT}`);
  });
} 