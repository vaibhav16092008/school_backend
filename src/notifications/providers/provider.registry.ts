import { NotificationChannel } from '../../lib/prisma';
import { NotificationChannelProvider } from './provider.interface';
import { MockEmailProvider } from './mock.email.provider';
import { MockSmsProvider } from './mock.sms.provider';
import { MockPushProvider } from './mock.push.provider';

class ProviderRegistry {
  private providers: Map<NotificationChannel, NotificationChannelProvider> = new Map();
  public mockEmail: MockEmailProvider;
  public mockSms: MockSmsProvider;
  public mockPush: MockPushProvider;

  constructor() {
    this.mockEmail = new MockEmailProvider();
    this.mockSms = new MockSmsProvider();
    this.mockPush = new MockPushProvider();

    this.providers.set(NotificationChannel.EMAIL, this.mockEmail);
    this.providers.set(NotificationChannel.SMS, this.mockSms);
    this.providers.set(NotificationChannel.PUSH, this.mockPush);
  }

  public getProvider(channel: NotificationChannel): NotificationChannelProvider | undefined {
    return this.providers.get(channel);
  }

  public setProvider(channel: NotificationChannel, provider: NotificationChannelProvider): void {
    this.providers.set(channel, provider);
  }

  public resetToMocks(): void {
    this.mockEmail = new MockEmailProvider();
    this.mockSms = new MockSmsProvider();
    this.mockPush = new MockPushProvider();

    this.providers.set(NotificationChannel.EMAIL, this.mockEmail);
    this.providers.set(NotificationChannel.SMS, this.mockSms);
    this.providers.set(NotificationChannel.PUSH, this.mockPush);
  }
}

export const providerRegistry = new ProviderRegistry();
