require('dotenv').config({ path: 'd:/Projects/Flutter/Smart-Ticketing-System/smarttransit-nest-backend/.env' });
const admin = require('firebase-admin');

async function clearFirebaseUsers() {
  try {
    const creds = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    admin.initializeApp({
      credential: admin.credential.cert(creds)
    });
    
    console.log("Fetching all Firebase users...");
    const listUsersResult = await admin.auth().listUsers(1000);
    const uids = listUsersResult.users.map(user => user.uid);
    
    if (uids.length === 0) {
      console.log("No users found in Firebase Auth. It is already clean!");
      process.exit(0);
    }
    
    console.log(`Deleting ${uids.length} users from Firebase Auth...`);
    const deleteResult = await admin.auth().deleteUsers(uids);
    console.log(`Successfully deleted ${deleteResult.successCount} users.`);
    
    if (deleteResult.failureCount > 0) {
      console.error(`Failed to delete ${deleteResult.failureCount} users.`);
      deleteResult.errors.forEach(err => console.error(err.error.toJSON()));
    }
    process.exit(0);
  } catch (err) {
    console.error("Error clearing Firebase users:", err);
    process.exit(1);
  }
}

clearFirebaseUsers();
