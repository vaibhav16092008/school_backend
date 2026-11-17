"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../../lib/prisma");
class StripeProvider {
    name = prisma_1.PaymentGatewayProvider.STRIPE;
    secretKey;
    publishableKey;
    webhookSecret;
    constructor() {
        this.secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
        this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';
    }
    async createOrder(options) {
        const timestamp = Date.now();
        const randomHex = crypto_1.default.randomBytes(4).toString('hex');
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
    async verifyPayment(options) {
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
    async verifyWebhookSignature(headers, rawBody) {
        const sigHeader = headers['stripe-signature'] || '';
        let bodyStr = '';
        let parsed = {};
        if (Buffer.isBuffer(rawBody)) {
            bodyStr = rawBody.toString('utf8');
            try {
                parsed = JSON.parse(bodyStr);
            }
            catch {
                parsed = {};
            }
        }
        else if (typeof rawBody === 'string') {
            bodyStr = rawBody;
            try {
                parsed = JSON.parse(bodyStr);
            }
            catch {
                parsed = {};
            }
        }
        else if (typeof rawBody === 'object' && rawBody !== null) {
            parsed = rawBody;
            bodyStr = JSON.stringify(rawBody);
        }
        // Parse stripe-signature header: t=12345,v1=signature
        const parts = sigHeader.split(',').reduce((acc, item) => {
            const [key, value] = item.trim().split('=');
            if (key && value)
                acc[key] = value;
            return acc;
        }, {});
        const timestamp = parts.t;
        const signature = parts.v1;
        let isValid = false;
        if (timestamp && signature) {
            const signedPayload = `${timestamp}.${bodyStr}`;
            const expectedSignature = crypto_1.default
                .createHmac('sha256', this.webhookSecret)
                .update(signedPayload)
                .digest('hex');
            try {
                isValid = crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(signature, 'utf8'));
            }
            catch {
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
    async processRefund(options) {
        return {
            success: true,
            refundId: `re_${crypto_1.default.randomBytes(10).toString('hex')}`,
            amount: options.amount || 0,
            status: 'succeeded',
        };
    }
}
exports.StripeProvider = StripeProvider;
