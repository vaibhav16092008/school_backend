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
import { ENV } from '../../config/env';

export class RazorpayProvider implements IPaymentProvider {
  public name: PaymentGatewayProvider = PaymentGatewayProvider.RAZORPAY;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder';
  }

  async createOrder(options: CreateOrderOptions): Promise<CreateOrderResult> {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const orderId = `order_${timestamp}_${randomHex}`;
    const amountInSubunits = Math.round(options.amount * 100);

    return {
      orderId,
      amount: options.amount,
      currency: options.currency || 'INR',
      provider: this.name,
      keyId: this.keyId,
      metadata: {
        amountInSubunits,
        invoiceId: options.invoiceId,
        schoolId: options.schoolId,
      },
    };
  }

  async verifyPayment(options: VerifyPaymentOptions): Promise<VerifyPaymentResult> {
    if (!options.signature) {
      return {
        success: false,
        transactionId: options.orderId,
        paymentId: options.paymentId,
        status: 'FAILED',
        failureReason: 'Missing Razorpay signature',
      };
    }

    const payload = `${options.orderId}|${options.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(options.signature, 'utf8')
    );

    if (!isValid) {
      return {
        success: false,
        transactionId: options.orderId,
        paymentId: options.paymentId,
        status: 'FAILED',
        failureReason: 'Invalid Razorpay signature',
      };
    }

    return {
      success: true,
      transactionId: options.orderId,
      paymentId: options.paymentId,
      status: 'SUCCESS',
      rawResponse: {
        provider: 'razorpay',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer | any
  ): Promise<WebhookEvent> {
    const signature = headers['x-razorpay-signature'] as string;
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

    if (!signature) {
      return {
        eventId: `rzp_evt_nosig_${Date.now()}`,
        eventType: 'unknown',
        payload: null,
        isValid: false,
        error: 'Missing X-Razorpay-Signature header',
      };
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(bodyStr)
      .digest('hex');

    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch {
      isValid = false;
    }

    if (!parsed || Object.keys(parsed).length === 0) {
      try {
        parsed = JSON.parse(bodyStr);
      } catch {
        // fallback
      }
    }

    if (!isValid) {
      return {
        eventId: parsed?.event_id || `rzp_evt_${Date.now()}`,
        eventType: parsed?.event || 'payment.failed',
        payload: parsed,
        isValid: false,
        error: 'Invalid Razorpay webhook signature',
      };
    }

    const paymentEntity = parsed?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : undefined;

    return {
      eventId: parsed?.event_id || `rzp_evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      eventType: parsed?.event || 'payment.captured',
      payload: parsed,
      isValid: true,
      orderId,
      paymentId,
      amount,
      status: parsed?.event === 'payment.captured' ? 'SUCCESS' : 'FAILED',
    };
  }

  async processRefund(options: RefundOptions): Promise<RefundResult> {
    return {
      success: true,
      refundId: `rfnd_${crypto.randomBytes(8).toString('hex')}`,
      amount: options.amount || 0,
      status: 'PROCESSED',
    };
  }
}
