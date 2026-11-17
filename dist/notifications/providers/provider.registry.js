"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerRegistry = void 0;
const prisma_1 = require("../../lib/prisma");
const mock_email_provider_1 = require("./mock.email.provider");
const mock_sms_provider_1 = require("./mock.sms.provider");
const mock_push_provider_1 = require("./mock.push.provider");
class ProviderRegistry {
    providers = new Map();
    mockEmail;
    mockSms;
    mockPush;
    constructor() {
        this.mockEmail = new mock_email_provider_1.MockEmailProvider();
        this.mockSms = new mock_sms_provider_1.MockSmsProvider();
        this.mockPush = new mock_push_provider_1.MockPushProvider();
        this.providers.set(prisma_1.NotificationChannel.EMAIL, this.mockEmail);
        this.providers.set(prisma_1.NotificationChannel.SMS, this.mockSms);
        this.providers.set(prisma_1.NotificationChannel.PUSH, this.mockPush);
    }
    getProvider(channel) {
        return this.providers.get(channel);
    }
    setProvider(channel, provider) {
        this.providers.set(channel, provider);
    }
    resetToMocks() {
        this.mockEmail = new mock_email_provider_1.MockEmailProvider();
        this.mockSms = new mock_sms_provider_1.MockSmsProvider();
        this.mockPush = new mock_push_provider_1.MockPushProvider();
        this.providers.set(prisma_1.NotificationChannel.EMAIL, this.mockEmail);
        this.providers.set(prisma_1.NotificationChannel.SMS, this.mockSms);
        this.providers.set(prisma_1.NotificationChannel.PUSH, this.mockPush);
    }
}
exports.providerRegistry = new ProviderRegistry();
