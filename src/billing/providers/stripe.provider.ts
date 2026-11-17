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

export class StripeProvider implements IPaymentProvider {
  public name: PaymentGatewayProvider = PaymentGatewayProvider.STRIPE;
  private secretKey: string;
  private publishableKey: string;
  private webhookSecret: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
  }

  async createOrder(options: CreateOrderOptions): Promise<CreateOrderResult> {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const orderId = `cs_test_${timestamp}_${randomHex}`; // Checkout session ID
    const clientSecret = `pi_${timestamp}_secret_${randomHex}`;

    return {
      orderId,
      amount: options.amount,
      currency: options.currency || 'USD',
      provider: this.name,
      clientSecret,
      keyId: this.publishableKey,
      metadata: {
        invoiceId: options.invoiceId,
        schoolId: options.schoolId,
      },
    };
  }

  async verifyPayment(options: VerifyPaymentOptions): Promise<VerifyPaymentResult> {
    // In Stripe, checkout session / payment intent status is verified on backend
    if (!options.paymentId || options.paymentId.includes('fail')) {
      return {
        success: false,
        transactionId: options.orderId,
        paymentId: options.paymentId,
        status: 'FAILED',
        failureReason: 'Stripe charge failed or incomplete',
      };
    }

    return {
      success: true,
      transactionId: options.orderId,
      paymentId: options.paymentId,
      status: 'SUCCESS',
      rawResponse: {
        provider: 'stripe',
        status: 'succeeded',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer | any
  ): Promise<WebhookEvent> {
    const sigHeader = (headers['stripe-signature'] as string) || '';
    let bodyStr = '';
    let parsed: any = {};
    if (Buffer.isBuffer(rawBody)) {
      bodyStr = rawBody.toString('utf8');
      try { parsed = JSON.parse(bodyStr); } catch { parsed = {}; }
    } else if (typeof rawBody === 'string') {
      bodyStr = rawBody;
      try { parsed = JSON.parse(bodyStr); } catch { parsed = {}; }
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      parsed = rawBody;
      bodyStr = JSON.stringify(rawBody);
    }

    // Parse stripe-signature header: t=12345,v1=signature
    const parts = sigHeader.split(',').reduce((acc: Record<string, string>, item) => {
      const [key, value] = item.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {});

    const timestamp = parts.t;
    const signature = parts.v1;

    let isValid = false;
    if (timestamp && signature) {
      const signedPayload = `${timestamp}.${bodyStr}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex');

      try {
        isValid = crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'utf8'),
          Buffer.from(signature, 'utf8')
        );
      } catch {
        isValid = false;
      }
    }

    if (!isValid) {
      return {
        eventId: parsed?.id || `str_evt_${Date.now()}`,
        eventType: parsed?.type || 'payment_intent.payment_failed',
        payload: parsed,
        isValid: false,
        error: 'Invalid Stripe signature header',
      };
    }

    const dataObject = parsed?.data?.object;
    const paymentId = dataObject?.id;
    const amount = dataObject?.amount ? dataObject.amount / 100 : undefined;

    return {
      eventId: parsed?.id || `str_evt_${Date.now()}`,
      eventType: parsed?.type || 'payment_intent.succeeded',
      payload: parsed,
      isValid: true,
      orderId: dataObject?.metadata?.orderId || paymentId,
      paymentId,
      amount,
      status: parsed?.type?.includes('succeeded') ? 'SUCCESS' : 'FAILED',
    };
  }

  async processRefund(options: RefundOptions): Promise<RefundResult> {
    return {
      success: true,
      refundId: `re_${crypto.randomBytes(10).toString('hex')}`,
      amount: options.amount || 0,
      status: 'succeeded',
    };
  }
}
