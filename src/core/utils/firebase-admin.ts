import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';

export function getFirebaseAdminApp(configService: ConfigService): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const credential = resolveCredential(configService);
  return admin.initializeApp({ credential });
}

function resolveCredential(configService: ConfigService): admin.credential.Credential {
  const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
  const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
  const privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

  if (projectId && clientEmail && privateKey) {
    // Strip leading/trailing double quotes if they exist (common Docker Compose env issue)
    const cleanedKey = privateKey.replace(/^"|"$/g, '');
    const formattedPrivateKey = cleanedKey.replace(/\\n/g, '\n');
    return admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: formattedPrivateKey,
    });
  }

  const json = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
  const base64 = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
  const path = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

  if (json) {
    return admin.credential.cert(JSON.parse(json));
  }

  if (base64) {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return admin.credential.cert(JSON.parse(decoded));
  }

  if (path) {
    const fileContents = readFileSync(path, 'utf8');
    return admin.credential.cert(JSON.parse(fileContents));
  }

  throw new Error('Missing Firebase service account configuration');
}
