const admin = require("firebase-admin");

const [legacyUsername, email] = process.argv.slice(2);
if (!legacyUsername || !email) {
  console.error("Usage: npm run migrate -- <legacy-username> <auth-email>");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "ramen-log-b811d"
});

async function migrateLegacyRecord() {
  const user = await admin.auth().getUserByEmail(email);
  if (!user.emailVerified) {
    throw new Error("Verify the Auth user's email before migrating records.");
  }

  const firestore = admin.firestore();
  const legacyRef = firestore.collection("ramenLogs").doc(legacyUsername);
  const targetRef = firestore.collection("ramenLogs").doc(user.uid);
  const [legacySnapshot, targetSnapshot] = await Promise.all([
    legacyRef.get(),
    targetRef.get()
  ]);

  if (!legacySnapshot.exists) {
    throw new Error(`Legacy record not found for username: ${legacyUsername}`);
  }

  const legacyData = legacySnapshot.data();
  if (!Array.isArray(legacyData.list)) {
    throw new Error("Legacy record does not contain a valid list.");
  }

  const targetData = targetSnapshot.exists ? targetSnapshot.data() : {};
  if (targetSnapshot.exists && targetData.ownerUid !== user.uid) {
    throw new Error("Target document is not owned by the selected Auth user.");
  }
  if (Array.isArray(targetData.list) && targetData.list.length > 0) {
    throw new Error("Target already contains records; nothing was changed.");
  }

  const migratedData = {
    ownerUid: user.uid,
    username: targetData.username || legacyData.username || legacyUsername,
    list: legacyData.list
  };
  const size = new TextEncoder().encode(JSON.stringify(migratedData)).length;
  if (size > 900 * 1024) {
    throw new Error("Migrated record is too close to Firestore's 1 MiB document limit.");
  }

  await targetRef.set(migratedData);
  console.log(`Copied ${legacyData.list.length} records to Auth UID ${user.uid}.`);
  console.log(`Legacy document '${legacyUsername}' was left unchanged.`);
}

migrateLegacyRecord().catch(error => {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
});
