import crypto from 'crypto';
import {
  IPaymentProvider,
  CreateOrderOptions,
  CreateOrderResult,
  VerifyPaymentOptions,
  VerifyPaymentResult,
  WebhookEvent,
  RefundOptions,
  RefundResult,
} from './payment-provider.interface';
import { PaymentGatewayProvider } from '../../lib/prisma';

export class MockPaymentProvider implements IPaymentProvider {
  public name: PaymentGatewayProvider = PaymentGatewayProvider.MOCK;
  private mockSecret: string = 'mock_secret_key_123';

  async createOrder(options: CreateOrderOptions): Promise<CreateOrderResult> {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const orderId = `mock_order_${timestamp}_${randomHex}`;

    return {
      orderId,
      amount: options.amount,
      currency: options.currency || 'USD',
      provider: this.name,
      clientSecret: `mock_secret_${randomHex}`,
      keyId: 'mock_publishable_key',
      metadata: {
        ...options.metadata,
        invoiceId: options.invoiceId,
        schoolId: options.schoolId,
      },
    };
  }

  async verifyPayment(options: VerifyPaymentOptions): Promise<VerifyPaymentResult> {
    // If testing failure simulation
    if (options.paymentId.includes('fail') || options.signature === 'INVALID_SIGNATURE') {
      return {
        success: false,
        transactionId: options.orderId,
        paymentId: options.paymentId,
        status: 'FAILED',
        failureReason: 'Card declined or simulated mock failure',
      };
    }

    return {
      success: true,
      transactionId: options.orderId,
      paymentId: options.paymentId || `mock_pay_${Date.now()}`,
      status: 'SUCCESS',
      rawResponse: {
        mode: 'mock',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer | any
  ): Promise<WebhookEvent> {
    const signature = headers['x-mock-signature'] || headers['x-webhook-signature'];

    let parsed: any = {};
    let bodyStr = '';
    if (Buffer.isBuffer(rawBody)) {
      bodyStr = rawBody.toString('utf8');
      try {
        parsed = JSON.parse(bodyStr);
      } catch {
        parsed = {};
      }
    } else if (typeof rawBody === 'string') {
      bodyStr = rawBody;
      try {
        parsed = JSON.parse(bodyStr);
      } catch {
        parsed = {};
      }
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      parsed = rawBody;
      bodyStr = JSON.stringify(rawBody);
    }

    // Expected signature calculation: sha256 HMAC of body with mockSecret
    const expectedSignature = crypto
      .createHmac('sha256', this.mockSecret)
      .update(bodyStr)
      .digest('hex');

    const isValid = signature === expectedSignature || signature === 'MOCK_TEST_SIGNATURE';

    if (!isValid) {
      return {
        eventId: parsed.eventId || `mock_evt_${Date.now()}`,
        eventType: parsed.eventType || 'payment.failed',
        payload: parsed,
        isValid: false,
        error: 'Invalid mock webhook signature',
      };
    }

    return {
      eventId: parsed.eventId || `mock_evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      eventType: parsed.eventType || 'payment.succeeded',
      payload: parsed,
      isValid: true,
      orderId: parsed.orderId,
      paymentId: parsed.paymentId,
      amount: parsed.amount,
      status: parsed.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
    };
  }

  async processRefund(options: RefundOptions): Promise<RefundResult> {
    return {
      success: true,
      refundId: `mock_ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      amount: options.amount || 0,
      status: 'PROCESSED',
    };
  }
}
