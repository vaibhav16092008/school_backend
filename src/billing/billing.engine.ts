import { BillingCycle, DiscountType } from '../lib/prisma';
import { prisma } from '../lib/prisma';

export interface ProrationResult {
  daysTotal: number;
  daysRemaining: number;
  unusedCurrentPlanCredit: number;
  proratedNewPlanCost: number;
  netPayableAmount: number;
}

export interface CouponCalculationResult {
  isValid: boolean;
  discountAmount: number;
  couponCode?: string;
  errorMessage?: string;
}

export class BillingEngine {
  /**
   * Round to 2 decimal places safely without floating-point drift
   */
  public static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculate proration when upgrading plans mid-period
   */
  public static calculateProration(
    currentPlanPeriodCost: number,
    newPlanPeriodCost: number,
    periodStart: Date,
    periodEnd: Date,
    effectiveDate: Date = new Date()
  ): ProrationResult {
    const totalMs = periodEnd.getTime() - periodStart.getTime();
    const remainingMs = Math.max(0, periodEnd.getTime() - effectiveDate.getTime());

    const daysTotal = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    const ratio = daysRemaining / daysTotal;

    const unusedCurrentPlanCredit = this.round2(currentPlanPeriodCost * ratio);
    const proratedNewPlanCost = this.round2(newPlanPeriodCost * ratio);
    const netPayableAmount = Math.max(0, this.round2(proratedNewPlanCost - unusedCurrentPlanCredit));

    return {
      daysTotal,
      daysRemaining,
      unusedCurrentPlanCredit,
      proratedNewPlanCost,
      netPayableAmount,
    };
  }

  /**
   * Calculate coupon discount safely
   */
  public static calculateCouponDiscount(
    subtotal: number,
    coupon?: {
      code: string;
      discountType: DiscountType;
      discountValue: any; // Decimal or number
      maxDiscountAmount?: any;
      minBillingAmount?: any;
      validFrom: Date;
      validUntil?: Date | null;
      isActive: boolean;
      usedCount: number;
      maxUses?: number | null;
      applicablePlans?: string[];
    } | null,
    planCode?: string
  ): CouponCalculationResult {
    if (!coupon) {
      return { isValid: false, discountAmount: 0 };
    }

    if (!coupon.isActive) {
      return { isValid: false, discountAmount: 0, errorMessage: 'Coupon is not active' };
    }

    const now = new Date();
    if (now < new Date(coupon.validFrom)) {
      return { isValid: false, discountAmount: 0, errorMessage: 'Coupon validity has not started' };
    }
    if (coupon.validUntil && now > new Date(coupon.validUntil)) {
      return { isValid: false, discountAmount: 0, errorMessage: 'Coupon has expired' };
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { isValid: false, discountAmount: 0, errorMessage: 'Coupon usage limit reached' };
    }

    if (coupon.minBillingAmount) {
      const minAmount = Number(coupon.minBillingAmount);
      if (subtotal < minAmount) {
        return {
          isValid: false,
          discountAmount: 0,
          errorMessage: `Minimum order amount of $${minAmount.toFixed(2)} required to apply this coupon`,
        };
      }
    }

    if (coupon.applicablePlans && coupon.applicablePlans.length > 0 && planCode) {
      if (!coupon.applicablePlans.includes(planCode)) {
        return {
          isValid: false,
          discountAmount: 0,
          errorMessage: `Coupon is not applicable to the ${planCode} plan`,
        };
      }
    }

    let rawDiscount = 0;
    const discVal = Number(coupon.discountValue);
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      rawDiscount = (subtotal * discVal) / 100;
    } else {
      rawDiscount = discVal;
    }

    if (coupon.maxDiscountAmount) {
      const maxCap = Number(coupon.maxDiscountAmount);
      rawDiscount = Math.min(rawDiscount, maxCap);
    }

    const finalDiscount = Math.min(subtotal, this.round2(rawDiscount));

    return {
      isValid: true,
      discountAmount: finalDiscount,
      couponCode: coupon.code,
    };
  }

  /**
   * Calculate complete invoice amounts: Subtotal, Discount, Tax, Total
   */
  public static computeInvoiceTotals(
    subtotal: number,
    discountAmount: number = 0,
    taxPercentage: number = 0
  ) {
    const safeSubtotal = this.round2(subtotal);
    const safeDiscount = Math.min(safeSubtotal, this.round2(discountAmount));
    const taxableAmount = Math.max(0, this.round2(safeSubtotal - safeDiscount));
    const taxAmount = this.round2((taxableAmount * taxPercentage) / 100);
    const totalAmount = this.round2(taxableAmount + taxAmount);

    return {
      subtotal: safeSubtotal,
      discountAmount: safeDiscount,
      taxableAmount,
      taxPercentage: this.round2(taxPercentage),
      taxAmount,
      totalAmount,
    };
  }

  /**
   * Generate next invoice number
   */
  public static async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.billing_invoices.count();
    const sequence = String(count + 1).padStart(5, '0');
    return `INV-SAAS-${year}-${sequence}`;
  }

  /**
   * Generate next payment number
   */
  public static async generatePaymentNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.billing_payments.count();
    const sequence = String(count + 1).padStart(5, '0');
    return `PAY-SAAS-${year}-${sequence}`;
  }

  /**
   * Calculate cycle period end
   */
  public static calculatePeriodEnd(startDate: Date, cycle: BillingCycle): Date {
    const end = new Date(startDate);
    switch (cycle) {
      case BillingCycle.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case BillingCycle.QUARTERLY:
        end.setMonth(end.getMonth() + 3);
        break;
      case BillingCycle.SEMI_ANNUAL:
        end.setMonth(end.getMonth() + 6);
        break;
      case BillingCycle.ANNUAL:
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    return end;
  }
}
