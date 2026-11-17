import { NotificationChannel } from '../../lib/prisma';
import { DeliveryPayload, DeliveryResult, NotificationChannelProvider } from './provider.interface';

export interface SandboxSmsLog {
  id: string;
  phone: string;
  content: string;
  timestamp: Date;
}

export class MockSmsProvider implements NotificationChannelProvider {
  public readonly channel = NotificationChannel.SMS;
  private sentLogs: SandboxSmsLog[] = [];
  private shouldFailNext: boolean = false;
  private failureError: string = 'Simulated SMS Gateway timeout';

  public async send(payload: DeliveryPayload): Promise<DeliveryResult> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        errorMessage: this.failureError,
      };
    }

    const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const logEntry: SandboxSmsLog = {
      id: messageId,
      phone: payload.recipientTarget,
      content: payload.content,
      timestamp: new Date(),
    };

    this.sentLogs.push(logEntry);

    return {
      success: true,
      messageId,
      providerResponse: {
        provider: 'MockSmsProvider (Sandbox)',
        segments: 1,
        status: 'DELIVERED_SANDBOX',
      },
    };
  }

  public getSentLogs(): SandboxSmsLog[] {
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
