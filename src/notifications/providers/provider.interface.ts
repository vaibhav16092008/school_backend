import { NotificationChannel, NotificationPriority } from '../../lib/prisma';

export interface DeliveryPayload {
  recipientTarget: string;       // Email address, phone number, push token, or internal userId
  recipientName?: string;
  subject?: string;
  content: string;
  data?: Record<string, any>;
  channel: NotificationChannel;
  priority?: NotificationPriority;
}

export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  errorMessage?: string;
  providerResponse?: Record<string, any>;
}

export interface NotificationChannelProvider {
  readonly channel: NotificationChannel;
  send(payload: DeliveryPayload): Promise<DeliveryResult>;
}
