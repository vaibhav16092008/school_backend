"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RazorpayProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../../lib/prisma");
class RazorpayProvider {
    name = prisma_1.PaymentGatewayProvider.RAZORPAY;
    keyId;
    keySecret;
    webhookSecret;
    constructor() {
        this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
        this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder';
        this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_placeholder';
    }
    async createOrder(options) {
        const timestamp = Date.now();
        const randomHex = crypto_1.default.randomBytes(4).toString('hex');
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
    async verifyPayment(options) {
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
        const expectedSignature = crypto_1.default
            .createHmac('sha256', this.keySecret)
            .update(payload)
            .digest('hex');
        const isValid = crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(options.signature, 'utf8'));
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
    async verifyWebhookSignature(headers, rawBody) {
        const signature = headers['x-razorpay-signature'];
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
        if (!signature) {
            return {
                eventId: `rzp_evt_nosig_${Date.now()}`,
                eventType: 'unknown',
                payload: null,
                isValid: false,
                error: 'Missing X-Razorpay-Signature header',
            };
        }
        const expectedSignature = crypto_1.default
            .createHmac('sha256', this.webhookSecret)
            .update(bodyStr)
            .digest('hex');
        let isValid = false;
        try {
            isValid = crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(signature, 'utf8'));
        }
        catch {
            isValid = false;
        }
        if (!parsed || Object.keys(parsed).length === 0) {
            try {
                parsed = JSON.parse(bodyStr);
            }
            catch {
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
            eventId: parsed?.event_id || `rzp_evt_${Date.now()}_${crypto_1.default.randomBytes(3).toString('hex')}`,
            eventType: parsed?.event || 'payment.captured',
            payload: parsed,
            isValid: true,
            orderId,
            paymentId,
            amount,
            status: parsed?.event === 'payment.captured' ? 'SUCCESS' : 'FAILED',
        };
    }
    async processRefund(options) {
        return {
            success: true,
            refundId: `rfnd_${crypto_1.default.randomBytes(8).toString('hex')}`,
            amount: options.amount || 0,
            status: 'PROCESSED',
        };
    }
}
exports.RazorpayProvider = RazorpayProvider;
