const { MongoClient } = require('mongodb');
let client;
let db;

module.exports = async function getDB() {
  if (db) return db;
  client = await MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  db = client.db('snake-game');
  return db;
}; 