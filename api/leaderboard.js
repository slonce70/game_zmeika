const getDB = require('./lib/db');

module.exports = async (req, res) => {
  try {
    const db = await getDB();
    const collection = db.collection('leaderboard');
    const now = new Date();
    const thirtySecAgo = new Date(Date.now() - 30000);

    if (req.method === 'GET') {
      const leaderboard = await collection.find({}).sort({ score: -1 }).limit(10).toArray();
      const activePlayers = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
      return res.status(200).json({ scores: leaderboard, activePlayers });
    }

    if (req.method === 'POST') {
      const { username, score } = req.body || {};
      if (!username || typeof score !== 'number') {
        return res.status(400).json({ error: 'Invalid data' });
      }
      const player = await collection.findOne({ username });
      if (player) {
        const updateDoc = { $set: { lastActive: now } };
        if (score > player.score) {
          updateDoc.$set.score = score;
          updateDoc.$set.date = now.toISOString();
        }
        await collection.updateOne({ username }, updateDoc);
      } else {
        await collection.insertOne({ username, score, date: now.toISOString(), lastActive: now });
      }
      const leaderboard = await collection.find({}).sort({ score: -1 }).limit(10).toArray();
      const rank = leaderboard.findIndex(entry => entry.username === username) + 1;
      const activePlayers = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
      return res.status(200).json({ rank, leaderboard, activePlayers });
    }

    return res.status(405).end();
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}; 