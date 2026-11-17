"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRegistry = exports.PaymentProviderRegistry = void 0;
const prisma_1 = require("../../lib/prisma");
const mock_payment_provider_1 = require("./mock-payment.provider");
const razorpay_provider_1 = require("./razorpay.provider");
const stripe_provider_1 = require("./stripe.provider");
class PaymentProviderRegistry {
    static instance;
    providers = new Map();
    constructor() {
        this.providers.set(prisma_1.PaymentGatewayProvider.MOCK, new mock_payment_provider_1.MockPaymentProvider());
        this.providers.set(prisma_1.PaymentGatewayProvider.RAZORPAY, new razorpay_provider_1.RazorpayProvider());
        this.providers.set(prisma_1.PaymentGatewayProvider.STRIPE, new stripe_provider_1.StripeProvider());
    }
    static getInstance() {
        if (!PaymentProviderRegistry.instance) {
            PaymentProviderRegistry.instance = new PaymentProviderRegistry();
        }
        return PaymentProviderRegistry.instance;
    }
    getProvider(providerName) {
        if (!providerName) {
            return this.providers.get(prisma_1.PaymentGatewayProvider.MOCK);
        }
        const key = providerName.toUpperCase();
        const provider = this.providers.get(key);
        if (!provider) {
            return this.providers.get(prisma_1.PaymentGatewayProvider.MOCK);
        }
        return provider;
    }
}
exports.PaymentProviderRegistry = PaymentProviderRegistry;
exports.paymentRegistry = PaymentProviderRegistry.getInstance();
