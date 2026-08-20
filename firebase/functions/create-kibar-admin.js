const admin = require("firebase-admin");

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or service account)
admin.initializeApp({
  projectId: "mauze-tahfeez-atfal",
});

const auth = admin.auth();
const db = admin.firestore();

async function createKibarAdmin() {
  const email = "mh.devloper53@gmail.com";
  const password = "123456";
  const fullName = "Kibar Admin";
  const portalRole = "kibar-admin";

  try {
    // 1. Create or get Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: true,
      });
      console.log("Created auth user:", userRecord.uid);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        userRecord = await auth.getUserByEmail(email);
        await auth.updateUser(userRecord.uid, { password, displayName: fullName, emailVerified: true });
        console.log("Updated existing auth user:", userRecord.uid);
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;
    const now = new Date().toISOString();

    // 2. Create users/{uid} document
    const userDoc = {
      email,
      full_name: fullName,
      portal_role: portalRole,
      is_active: true,
      created_at: now,
      updated_at: now,
      salary_per_minute: 0,
      show_salary_card: false,
      id: uid,
    };
    await db.collection("users").doc(uid).set(userDoc, { merge: true });
    console.log("Created/updated users/" + uid);

    // 3. Create kibar_user_portal_access/{uid} document
    const portalAccessDoc = {
      user_id: uid,
      email,
      full_name: fullName,
      portal_role: portalRole,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    await db.collection("kibar_user_portal_access").doc(uid).set(portalAccessDoc, { merge: true });
    console.log("Created/updated kibar_user_portal_access/" + uid);

    console.log("\n✅ Kibar Admin created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("UID:", uid);
    console.log("Portal Role:", portalRole);
    console.log("\nYou can now log in at the Kibar Admin portal tab.");
    
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    process.exit(0);
  }
}

createKibarAdmin();