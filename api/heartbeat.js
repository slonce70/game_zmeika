const getDB = require('./lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  try {
    const { username } = req.body || {};
    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    const db = await getDB();
    const collection = db.collection('leaderboard');
    const now = new Date();
    await collection.updateOne({ username }, { $set: { lastActive: now } }, { upsert: true });
    const activeCount = await collection.countDocuments({ lastActive: { $gte: new Date(Date.now() - 30000) } });
    res.json({ activePlayers: activeCount });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}; 