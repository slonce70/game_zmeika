require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

let db;

// Подключение к MongoDB
async function connectToDb() {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    db = client.db('snake-game');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// API endpoints
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await db.collection('leaderboard')
      .find()
      .sort({ score: -1 })
      .limit(100)
      .toArray();
    
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  try {
    const { username, score } = req.body;
    
    if (!username || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // Ищем существующий результат игрока
    const existingPlayer = await db.collection('leaderboard')
      .findOne({ username });
    
    if (existingPlayer) {
      // Обновляем только если новый результат лучше
      if (score > existingPlayer.score) {
        await db.collection('leaderboard').updateOne(
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
      await db.collection('leaderboard').insertOne({
        username,
        score,
        date: new Date().toISOString()
      });
    }

    // Получаем обновленную таблицу лидеров
    const leaderboard = await db.collection('leaderboard')
      .find()
      .sort({ score: -1 })
      .limit(100)
      .toArray();

    // Определяем ранг игрока
    const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
    
    res.json({ rank, leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// Запуск сервера
async function startServer() {
  await connectToDb();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer(); 