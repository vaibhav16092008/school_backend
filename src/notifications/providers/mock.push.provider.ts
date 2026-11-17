import { NotificationChannel } from '../../lib/prisma';
import { DeliveryPayload, DeliveryResult, NotificationChannelProvider } from './provider.interface';

export interface SandboxPushLog {
  id: string;
  token: string;
  title?: string;
  body: string;
  timestamp: Date;
}

export class MockPushProvider implements NotificationChannelProvider {
  public readonly channel = NotificationChannel.PUSH;
  private sentLogs: SandboxPushLog[] = [];
  private shouldFailNext: boolean = false;
  private failureError: string = 'Simulated APNS/FCM connection drop';

  public async send(payload: DeliveryPayload): Promise<DeliveryResult> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        errorMessage: this.failureError,
      };
    }

    const messageId = `push_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const logEntry: SandboxPushLog = {
      id: messageId,
      token: payload.recipientTarget,
      title: payload.subject,
      body: payload.content,
      timestamp: new Date(),
    };

    this.sentLogs.push(logEntry);

    return {
      success: true,
      messageId,
      providerResponse: {
        provider: 'MockPushProvider (Sandbox)',
        multicastId: messageId,
        successCount: 1,
      },
    };
  }

  public getSentLogs(): SandboxPushLog[] {
    return [...this.sentLogs];
  }

  public clearLogs(): void {
    this.sentLogs = [];
  }

  public setFailNext(fail: boolean = true, error?: string): void {
    this.shouldFailNext = fail;
    if (error) this.failureError = error;
  }
}
