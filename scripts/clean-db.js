const mongoose = require('mongoose');

// Connection URI from .env (DEV Database)
const uri = "mongodb://dilshanhp31_db_user:Of3DlksJEg2daA85@ac-brt0v6c-shard-00-00.r7ffq0c.mongodb.net:27017,ac-brt0v6c-shard-00-01.r7ffq0c.mongodb.net:27017,ac-brt0v6c-shard-00-02.r7ffq0c.mongodb.net:27017/smart_transit_dev?ssl=true&authSource=admin&replicaSet=atlas-vboe5w-shard-0&appName=Cluster0";

async function main() {
  try {
    console.log("Connecting to MongoDB Atlas using Mongoose...");
    await mongoose.connect(uri);
    console.log("Connected successfully.");

    const connection = mongoose.connection;
    const db = connection.db;

    // Get collection reference
    const collection = db.collection('passengers');

    // 1. Delete all passengers created during testing to start with a fresh, clean slate
    console.log("Deleting all existing passengers from the database...");
    const deleteRes = await collection.deleteMany({});
    console.log(`Deleted ${deleteRes.deletedCount} passenger(s).`);

    // 2. Drop the old nfcUid index if exists
    console.log("Checking indexes on passengers collection...");
    const indexes = await collection.indexes();
    console.log("Current indexes:", indexes.map(idx => idx.name));

    const nfcIndexExists = indexes.some(idx => idx.name === 'nfcUid_1');
    if (nfcIndexExists) {
      console.log("Dropping index 'nfcUid_1' to ensure Mongoose can recreate it properly as unique & sparse...");
      await collection.dropIndex('nfcUid_1');
      console.log("Index dropped successfully.");
    } else {
      console.log("No nfcUid_1 index to drop.");
    }

    console.log("Database cleanup completed successfully! You can register a new passenger now.");
  } catch (err) {
    console.error("An error occurred during database cleanup:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Connection closed.");
  }
}

main();
