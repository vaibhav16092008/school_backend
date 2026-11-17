import { PaymentGatewayProvider } from '../../lib/prisma';

export interface CreateOrderOptions {
  amount: number; // in standard unit, e.g. USD dollars
  currency: string;
  invoiceId: string;
  schoolId: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  provider: PaymentGatewayProvider;
  clientSecret?: string;
  keyId?: string;
  metadata?: Record<string, any>;
}

export interface VerifyPaymentOptions {
  orderId: string;
  paymentId: string;
  signature?: string;
  payload?: any;
}

export interface VerifyPaymentResult {
  success: boolean;
  transactionId: string;
  paymentId: string;
  status: 'SUCCESS' | 'FAILED';
  failureReason?: string;
  rawResponse?: any;
}

export interface RefundOptions {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
}

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  payload: any;
  isValid: boolean;
  orderId?: string;
  paymentId?: string;
  amount?: number;
  status?: 'SUCCESS' | 'FAILED';
  error?: string;
}

export interface IPaymentProvider {
  name: PaymentGatewayProvider;
  createOrder(options: CreateOrderOptions): Promise<CreateOrderResult>;
  verifyPayment(options: VerifyPaymentOptions): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, rawBody: string | Buffer): Promise<WebhookEvent>;
  processRefund?(options: RefundOptions): Promise<RefundResult>;
}
