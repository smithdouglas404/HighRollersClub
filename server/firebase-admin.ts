import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App;
let adminAuth: Auth;

export function getFirebaseAdmin(): { app: App; auth: Auth } | null {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && !process.env.FIREBASE_PROJECT_ID) {
    return null;
  }

  if (!adminApp) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
    } else {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (serviceAccount) {
        try {
          const parsed = JSON.parse(serviceAccount);
          adminApp = initializeApp({ credential: cert(parsed) });
        } catch {
          console.warn("Firebase: Invalid service account JSON, initializing with project ID");
          adminApp = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
        }
      } else {
        adminApp = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
      }
    }
    adminAuth = getAuth(adminApp);
  }
  return { app: adminApp, auth: adminAuth };
}

export async function verifyFirebaseToken(idToken: string): Promise<{ uid: string; email?: string; name?: string; picture?: string } | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;

  try {
    const decoded = await admin.auth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
    };
  } catch (err) {
    console.error("Firebase token verification failed:", err);
    return null;
  }
}
