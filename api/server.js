const { MongoClient } = require('mongodb');

let cachedDb = null;

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
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    const db = await connectToDatabase(process.env.MONGODB_URI);
    const collection = db.collection('leaderboard');

    if (req.method === 'GET') {
      const leaderboard = await collection
        .find({})
        .sort({ score: -1 })
        .limit(100)
        .toArray();
      
      res.json(leaderboard);
    } 
    else if (req.method === 'POST') {
      const { username, score } = req.body;
      
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
      
      res.json({ rank, leaderboard });
    }
  } catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
}; 