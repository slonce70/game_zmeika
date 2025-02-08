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
    await collection.updateOne({ username }, { $set: { lastActive: new Date(0) } });
    const thirtySecAgo = new Date(Date.now() - 30000);
    const activeCount = await collection.countDocuments({ lastActive: { $gte: thirtySecAgo } });
    res.json({ activePlayers: activeCount });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}; 