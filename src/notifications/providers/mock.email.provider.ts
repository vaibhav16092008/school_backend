import { NotificationChannel } from '../../lib/prisma';
import { DeliveryPayload, DeliveryResult, NotificationChannelProvider } from './provider.interface';

export interface SandboxEmailLog {
  id: string;
  to: string;
  recipientName?: string;
  subject?: string;
  content: string;
  timestamp: Date;
}

export class MockEmailProvider implements NotificationChannelProvider {
  public readonly channel = NotificationChannel.EMAIL;
  private sentLogs: SandboxEmailLog[] = [];
  private shouldFailNext: boolean = false;
  private failureError: string = 'Simulated SMTP connection timeout';

  public async send(payload: DeliveryPayload): Promise<DeliveryResult> {
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      return {
        success: false,
        errorMessage: this.failureError,
      };
    }

    const messageId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const logEntry: SandboxEmailLog = {
      id: messageId,
      to: payload.recipientTarget,
      recipientName: payload.recipientName,
      subject: payload.subject,
      content: payload.content,
      timestamp: new Date(),
    };

    this.sentLogs.push(logEntry);

    return {
      success: true,
      messageId,
      providerResponse: {
        provider: 'MockEmailProvider (Sandbox)',
        accepted: [payload.recipientTarget],
        status: 'DELIVERED_SANDBOX',
      },
    };
  }

  public getSentLogs(): SandboxEmailLog[] {
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
