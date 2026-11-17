"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmailProvider = void 0;
const prisma_1 = require("../../lib/prisma");
class MockEmailProvider {
    channel = prisma_1.NotificationChannel.EMAIL;
    sentLogs = [];
    shouldFailNext = false;
    failureError = 'Simulated SMTP connection timeout';
    async send(payload) {
        if (this.shouldFailNext) {
            this.shouldFailNext = false;
            return {
                success: false,
                errorMessage: this.failureError,
            };
        }
        const messageId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const logEntry = {
            id: messageId,
            to: payload.recipientTarget,
            recipientName: payload.recipientName,
            subject: payload.subject,
            content: payload.content,
            timestamp: new Date(),
        };
        this.sentLogs.push(logEntry);
        return {
            success: true,
            messageId,
            providerResponse: {
                provider: 'MockEmailProvider (Sandbox)',
                accepted: [payload.recipientTarget],
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
exports.MockEmailProvider = MockEmailProvider;
