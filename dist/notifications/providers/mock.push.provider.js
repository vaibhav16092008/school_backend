"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPushProvider = void 0;
const prisma_1 = require("../../lib/prisma");
class MockPushProvider {
    channel = prisma_1.NotificationChannel.PUSH;
    sentLogs = [];
    shouldFailNext = false;
    failureError = 'Simulated APNS/FCM connection drop';
    async send(payload) {
        if (this.shouldFailNext) {
            this.shouldFailNext = false;
            return {
                success: false,
                errorMessage: this.failureError,
            };
        }
        const messageId = `push_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const logEntry = {
            id: messageId,
            token: payload.recipientTarget,
            title: payload.subject,
            body: payload.content,
            timestamp: new Date(),
        };
        this.sentLogs.push(logEntry);
        return {
            success: true,
            messageId,
            providerResponse: {
                provider: 'MockPushProvider (Sandbox)',
                multicastId: messageId,
                successCount: 1,
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
exports.MockPushProvider = MockPushProvider;
