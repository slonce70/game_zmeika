const { MongoClient } = require('mongodb');

let cachedDb = null;
let activePlayers = new Map(); // Хранит активных игроков и время их последней активности

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

module.exports = async (req, res) => {
  // Обновленная настройка CORS
  const allowedOrigins = [
    'https://game-zmeika.vercel.app',
    'http://localhost:3000',
    'http://localhost:9000'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Обработка heartbeat
    if (req.url.endsWith('/heartbeat')) {
      const { username } = req.body || {};
      if (username) {
        activePlayers.set(username, Date.now());
        return res.json({ activePlayers: activePlayers.size });
      }
      return res.status(400).json({ error: 'Username is required' });
    }

    // Обработка выхода игрока
    if (req.url.endsWith('/leave')) {
      const { username } = req.body || {};
      if (username) {
        activePlayers.delete(username);
      }
      return res.json({ activePlayers: activePlayers.size });
    }

    const db = await connectToDatabase(process.env.MONGODB_URI);
    const collection = db.collection('leaderboard');

    if (req.method === 'GET') {
      const leaderboard = await collection
        .find({})
        .sort({ score: -1 })
        .limit(100)
        .toArray();
      
      return res.json({
        scores: leaderboard,
        activePlayers: activePlayers.size
      });
    } 
    else if (req.method === 'POST') {
      const { username, score } = req.body || {};
      
      if (!username || typeof score !== 'number') {
        return res.status(400).json({ error: 'Invalid data' });
      }

      // Ищем существующий результат игрока
      const existingPlayer = await collection.findOne({ username });
      
      if (existingPlayer) {
        // Обновляем только если новый результат лучше
        if (score > existingPlayer.score) {
          await collection.updateOne(
            { username },
            { 
              $set: {
                score,
                date: new Date().toISOString()
              }
            }
          );
        }
      } else {
        // Добавляем новый результат
        await collection.insertOne({
          username,
          score,
          date: new Date().toISOString()
        });
      }

      // Получаем обновленную таблицу лидеров
      const leaderboard = await collection
        .find({})
        .sort({ score: -1 })
        .limit(100)
        .toArray();

      // Определяем ранг игрока
      const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
      
      return res.json({ 
        rank, 
        leaderboard,
        activePlayers: activePlayers.size
      });
    }
  } catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
}; 