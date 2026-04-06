import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let adminApp: App;
let adminAuth: Auth;

export function getFirebaseAdmin(): { app: App; auth: Auth } {
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
          console.warn("Firebase: Invalid service account JSON, initializing without credentials");
          adminApp = initializeApp();
        }
      } else {
        console.warn("Firebase: No FIREBASE_SERVICE_ACCOUNT_KEY set, initializing with defaults");
        adminApp = initializeApp();
      }
    }
    adminAuth = getAuth(adminApp);
  }
  return { app: adminApp, auth: adminAuth };
}

export async function verifyFirebaseToken(idToken: string) {
  const { auth } = getFirebaseAdmin();
  return auth.verifyIdToken(idToken);
}
