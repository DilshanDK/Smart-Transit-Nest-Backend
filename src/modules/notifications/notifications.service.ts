import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';

import { Passenger, PassengerDocument } from '../auth/schemas/passenger.schema';
import { Driver, DriverDocument } from '../auth/schemas/driver.schema';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationResult {
  delivered: boolean;
  messageId?: string;
  reason?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private messaging?: admin.messaging.Messaging;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Passenger.name)
    private readonly passengerModel: Model<PassengerDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
  ) {}

  async notifyPassenger(
    passengerId: string,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    const passenger = await this.passengerModel
      .findById(passengerId)
      .select('fcmToken');
    if (!passenger?.fcmToken) {
      this.logger.warn(`Passenger ${passengerId} has no FCM token`);
      return { delivered: false, reason: 'missing_token' };
    }

    return this.sendToToken(passenger.fcmToken, payload);
  }

  async notifyDriver(
    driverId: string,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    const driver = await this.driverModel.findById(driverId).select('fcmToken');
    if (!driver?.fcmToken) {
      this.logger.warn(`Driver ${driverId} has no FCM token`);
      return { delivered: false, reason: 'missing_token' };
    }

    return this.sendToToken(driver.fcmToken, payload);
  }

  private async sendToToken(
    token: string,
    payload: NotificationPayload,
  ): Promise<NotificationResult> {
    try {
      const messageId = await this.getMessaging().send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      });

      return { delivered: true, messageId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'FCM send failed';
      this.logger.warn(`FCM send failed: ${reason}`);
      return { delivered: false, reason };
    }
  }

  private getMessaging(): admin.messaging.Messaging {
    if (this.messaging) {
      return this.messaging;
    }

    if (!admin.apps.length) {
      const credential = this.resolveCredential();
      admin.initializeApp({ credential });
    }

    this.messaging = admin.messaging();
    return this.messaging;
  }

  private resolveCredential(): admin.credential.Credential {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (projectId && clientEmail && privateKey) {
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      return admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      });
    }

    const json = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    const base64 = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_BASE64',
    );
    const path = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );

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
}
