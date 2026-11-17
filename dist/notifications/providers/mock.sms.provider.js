"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSmsProvider = void 0;
const prisma_1 = require("../../lib/prisma");
class MockSmsProvider {
    channel = prisma_1.NotificationChannel.SMS;
    sentLogs = [];
    shouldFailNext = false;
    failureError = 'Simulated SMS Gateway timeout';
    async send(payload) {
        if (this.shouldFailNext) {
            this.shouldFailNext = false;
            return {
                success: false,
                errorMessage: this.failureError,
            };
        }
        const messageId = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const logEntry = {
            id: messageId,
            phone: payload.recipientTarget,
            content: payload.content,
            timestamp: new Date(),
        };
        this.sentLogs.push(logEntry);
        return {
            success: true,
            messageId,
            providerResponse: {
                provider: 'MockSmsProvider (Sandbox)',
                segments: 1,
                status: 'DELIVERED_SANDBOX',
            },
        };
    }
    getSentLogs() {
        return [...this.sentLogs];
    }
    clearLogs() {
        this.sentLogs = [];
    }
    setFailNext(fail = true, error) {
        this.shouldFailNext = fail;
        if (error)
            this.failureError = error;
    }
}
exports.MockSmsProvider = MockSmsProvider;
