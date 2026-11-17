"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryQueue = void 0;
const prisma_1 = require("../../lib/prisma");
const provider_registry_1 = require("../providers/provider.registry");
class DeliveryQueue {
    queue = [];
    isProcessing = false;
    concurrency = 5;
    activeWorkers = 0;
    timeoutMs = 5000; // 5s timeout protection against slow provider networks
    rateLimitDelayMs = 20; // 50 requests/sec theoretical rate
    /**
     * Enqueue a new delivery job for asynchronous processing.
     */
    enqueue(job) {
        this.queue.push(job);
        this.processQueue();
    }
    /**
     * Enqueue multiple delivery jobs.
     */
    enqueueBatch(jobs) {
        this.queue.push(...jobs);
        this.processQueue();
    }
    /**
     * Trigger processing of the queue if workers are available.
     */
    async processQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            while (this.queue.length > 0 && this.activeWorkers < this.concurrency) {
                const job = this.queue.shift();
                if (!job)
                    break;
                this.activeWorkers++;
                this.executeJob(job).finally(() => {
                    this.activeWorkers--;
                    if (this.queue.length > 0) {
                        this.processQueue();
                    }
                });
                if (this.rateLimitDelayMs > 0) {
                    await new Promise((r) => setTimeout(r, this.rateLimitDelayMs));
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Synchronously drain/flush queue — useful for automated test assertions!
     */
    async drainQueue() {
        while (this.queue.length > 0 || this.activeWorkers > 0) {
            this.processQueue();
            await new Promise((r) => setTimeout(r, 50));
        }
    }
    /**
     * Execute an individual delivery job with idempotency, timeout, and retry backoff.
     */
    async executeJob(job) {
        // 1. Idempotency Check: if already DELIVERED or SENT in database, skip
        const existing = await prisma_1.prisma.notification_deliveries.findUnique({
            where: { id: job.deliveryId },
        });
        if (!existing || existing.status === prisma_1.DeliveryStatus.DELIVERED || existing.status === prisma_1.DeliveryStatus.SENT) {
            return; // Already processed
        }
        const currentAttempt = existing.attemptCount + 1;
        // 2. Resolve provider for channel
        const provider = provider_registry_1.providerRegistry.getProvider(job.channel);
        if (!provider) {
            await prisma_1.prisma.notification_deliveries.update({
                where: { id: job.deliveryId },
                data: {
                    status: prisma_1.DeliveryStatus.FAILED,
                    attemptCount: currentAttempt,
                    lastAttemptAt: new Date(),
                    errorMessage: `No active provider configured for channel ${job.channel}`,
                },
            });
            return;
        }
        const payload = {
            recipientTarget: job.recipientTarget,
            recipientName: job.recipientName,
            subject: job.subject,
            content: job.content,
            data: job.data,
            channel: job.channel,
        };
        try {
            // 3. Provider call wrapped with timeout protection
            const providerPromise = provider.send(payload);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Provider call timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
            });
            const result = await Promise.race([providerPromise, timeoutPromise]);
            if (result.success) {
                // Success
                await prisma_1.prisma.notification_deliveries.update({
                    where: { id: job.deliveryId },
                    data: {
                        status: prisma_1.DeliveryStatus.DELIVERED,
                        attemptCount: currentAttempt,
                        lastAttemptAt: new Date(),
                        deliveredAt: new Date(),
                        providerResponse: result.providerResponse || {},
                        errorMessage: null,
                    },
                });
            }
            else {
                // Provider reported failure
                await this.handleJobFailure(job, currentAttempt, result.errorMessage || 'Provider delivery rejected');
            }
        }
        catch (err) {
            // Exception or timeout
            await this.handleJobFailure(job, currentAttempt, err.message || 'Unknown network error');
        }
    }
    /**
     * Handle job failure: determine if eligible for retry or mark as permanently failed.
     */
    async handleJobFailure(job, currentAttempt, errorMessage) {
        const isRetryable = currentAttempt < job.maxAttempts;
        const nextStatus = isRetryable ? prisma_1.DeliveryStatus.RETRYING : prisma_1.DeliveryStatus.FAILED;
        await prisma_1.prisma.notification_deliveries.update({
            where: { id: job.deliveryId },
            data: {
                status: nextStatus,
                attemptCount: currentAttempt,
                lastAttemptAt: new Date(),
                errorMessage,
            },
        });
        if (isRetryable) {
            // Exponential backoff delay: 2^attempt * 500ms
            const backoffDelay = Math.pow(2, currentAttempt) * 500;
            setTimeout(() => {
                this.enqueue({
                    ...job,
                    attemptCount: currentAttempt,
                });
            }, backoffDelay);
        }
    }
}
exports.deliveryQueue = new DeliveryQueue();
