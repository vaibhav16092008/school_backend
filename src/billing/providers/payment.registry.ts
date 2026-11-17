import { PaymentGatewayProvider } from '../../lib/prisma';
import { IPaymentProvider } from './payment-provider.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { RazorpayProvider } from './razorpay.provider';
import { StripeProvider } from './stripe.provider';

export class PaymentProviderRegistry {
  private static instance: PaymentProviderRegistry;
  private providers: Map<PaymentGatewayProvider, IPaymentProvider> = new Map();

  private constructor() {
    this.providers.set(PaymentGatewayProvider.MOCK, new MockPaymentProvider());
    this.providers.set(PaymentGatewayProvider.RAZORPAY, new RazorpayProvider());
    this.providers.set(PaymentGatewayProvider.STRIPE, new StripeProvider());
  }

  public static getInstance(): PaymentProviderRegistry {
    if (!PaymentProviderRegistry.instance) {
      PaymentProviderRegistry.instance = new PaymentProviderRegistry();
    }
    return PaymentProviderRegistry.instance;
  }

  public getProvider(providerName?: PaymentGatewayProvider | string): IPaymentProvider {
    if (!providerName) {
      return this.providers.get(PaymentGatewayProvider.MOCK)!;
    }

    const key = providerName.toUpperCase() as PaymentGatewayProvider;
    const provider = this.providers.get(key);
    if (!provider) {
      return this.providers.get(PaymentGatewayProvider.MOCK)!;
    }
    return provider;
  }
}

export const paymentRegistry = PaymentProviderRegistry.getInstance();
