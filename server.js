const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// Путь к файлу с данными
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

// Загрузка таблицы лидеров
async function loadLeaderboard() {
  try {
    const data = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Сохранение таблицы лидеров
async function saveLeaderboard(leaderboard) {
  await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
}

// API endpoints
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await loadLeaderboard();
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

    let leaderboard = await loadLeaderboard();
    
    // Ищем существующий результат игрока
    const existingPlayerIndex = leaderboard.findIndex(entry => entry.username === username);
    
    if (existingPlayerIndex !== -1) {
      // Если новый результат лучше, обновляем запись
      if (score > leaderboard[existingPlayerIndex].score) {
        leaderboard[existingPlayerIndex] = {
          username,
          score,
          date: new Date().toISOString()
        };
      }
    } else {
      // Добавляем новый результат
      leaderboard.push({
        username,
        score,
        date: new Date().toISOString()
      });
    }
    
    // Сортируем по убыванию очков
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Оставляем только топ-100
    leaderboard = leaderboard.slice(0, 100);
    
    await saveLeaderboard(leaderboard);
    
    // Определяем ранг игрока
    const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
    
    res.json({ rank, leaderboard });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// Маршрут для всех остальных запросов (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 