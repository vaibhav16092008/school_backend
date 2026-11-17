import { prisma, DeliveryStatus, NotificationChannel } from '../../lib/prisma';
import { providerRegistry } from '../providers/provider.registry';
import { DeliveryPayload } from '../providers/provider.interface';

export interface DeliveryJob {
  deliveryId: string;
  notificationId: string;
  userId: string;
  schoolId: string;
  channel: NotificationChannel;
  recipientTarget: string;
  recipientName?: string;
  subject?: string;
  content: string;
  data?: Record<string, any>;
  attemptCount: number;
  maxAttempts: number;
  idempotencyKey?: string;
}

class DeliveryQueue {
  private queue: DeliveryJob[] = [];
  private isProcessing: boolean = false;
  private concurrency: number = 5;
  private activeWorkers: number = 0;
  private timeoutMs: number = 5000; // 5s timeout protection against slow provider networks
  private rateLimitDelayMs: number = 20; // 50 requests/sec theoretical rate

  /**
   * Enqueue a new delivery job for asynchronous processing.
   */
  public enqueue(job: DeliveryJob): void {
    this.queue.push(job);
    this.processQueue();
  }

  /**
   * Enqueue multiple delivery jobs.
   */
  public enqueueBatch(jobs: DeliveryJob[]): void {
    this.queue.push(...jobs);
    this.processQueue();
  }

  /**
   * Trigger processing of the queue if workers are available.
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.activeWorkers < this.concurrency) {
        const job = this.queue.shift();
        if (!job) break;

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
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Synchronously drain/flush queue — useful for automated test assertions!
   */
  public async drainQueue(): Promise<void> {
    while (this.queue.length > 0 || this.activeWorkers > 0) {
      this.processQueue();
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /**
   * Execute an individual delivery job with idempotency, timeout, and retry backoff.
   */
  private async executeJob(job: DeliveryJob): Promise<void> {
    // 1. Idempotency Check: if already DELIVERED or SENT in database, skip
    const existing = await prisma.notification_deliveries.findUnique({
      where: { id: job.deliveryId },
    });

    if (!existing || existing.status === DeliveryStatus.DELIVERED || existing.status === DeliveryStatus.SENT) {
      return; // Already processed
    }

    const currentAttempt = existing.attemptCount + 1;

    // 2. Resolve provider for channel
    const provider = providerRegistry.getProvider(job.channel);
    if (!provider) {
      await prisma.notification_deliveries.update({
        where: { id: job.deliveryId },
        data: {
          status: DeliveryStatus.FAILED,
          attemptCount: currentAttempt,
          lastAttemptAt: new Date(),
          errorMessage: `No active provider configured for channel ${job.channel}`,
        },
      });
      return;
    }

    const payload: DeliveryPayload = {
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
      const timeoutPromise = new Promise<{ success: false; errorMessage: string }>((_, reject) => {
        setTimeout(() => reject(new Error(`Provider call timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
      });

      const result = await Promise.race([providerPromise, timeoutPromise]) as any;

      if (result.success) {
        // Success
        await prisma.notification_deliveries.update({
          where: { id: job.deliveryId },
          data: {
            status: DeliveryStatus.DELIVERED,
            attemptCount: currentAttempt,
            lastAttemptAt: new Date(),
            deliveredAt: new Date(),
            providerResponse: result.providerResponse || {},
            errorMessage: null,
          },
        });
      } else {
        // Provider reported failure
        await this.handleJobFailure(job, currentAttempt, result.errorMessage || 'Provider delivery rejected');
      }
    } catch (err: any) {
      // Exception or timeout
      await this.handleJobFailure(job, currentAttempt, err.message || 'Unknown network error');
    }
  }

  /**
   * Handle job failure: determine if eligible for retry or mark as permanently failed.
   */
  private async handleJobFailure(job: DeliveryJob, currentAttempt: number, errorMessage: string): Promise<void> {
    const isRetryable = currentAttempt < job.maxAttempts;
    const nextStatus = isRetryable ? DeliveryStatus.RETRYING : DeliveryStatus.FAILED;

    await prisma.notification_deliveries.update({
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

export const deliveryQueue = new DeliveryQueue();
