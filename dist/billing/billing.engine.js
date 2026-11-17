"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingEngine = void 0;
const prisma_1 = require("../lib/prisma");
const prisma_2 = require("../lib/prisma");
class BillingEngine {
    /**
     * Round to 2 decimal places safely without floating-point drift
     */
    static round2(val) {
        return Math.round((val + Number.EPSILON) * 100) / 100;
    }
    /**
     * Calculate proration when upgrading plans mid-period
     */
    static calculateProration(currentPlanPeriodCost, newPlanPeriodCost, periodStart, periodEnd, effectiveDate = new Date()) {
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
    static calculateCouponDiscount(subtotal, coupon, planCode) {
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
        if (coupon.discountType === prisma_1.DiscountType.PERCENTAGE) {
            rawDiscount = (subtotal * discVal) / 100;
        }
        else {
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
    static computeInvoiceTotals(subtotal, discountAmount = 0, taxPercentage = 0) {
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
    static async generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const count = await prisma_2.prisma.billing_invoices.count();
        const sequence = String(count + 1).padStart(5, '0');
        return `INV-SAAS-${year}-${sequence}`;
    }
    /**
     * Generate next payment number
     */
    static async generatePaymentNumber() {
        const year = new Date().getFullYear();
        const count = await prisma_2.prisma.billing_payments.count();
        const sequence = String(count + 1).padStart(5, '0');
        return `PAY-SAAS-${year}-${sequence}`;
    }
    /**
     * Calculate cycle period end
     */
    static calculatePeriodEnd(startDate, cycle) {
        const end = new Date(startDate);
        switch (cycle) {
            case prisma_1.BillingCycle.MONTHLY:
                end.setMonth(end.getMonth() + 1);
                break;
            case prisma_1.BillingCycle.QUARTERLY:
                end.setMonth(end.getMonth() + 3);
                break;
            case prisma_1.BillingCycle.SEMI_ANNUAL:
                end.setMonth(end.getMonth() + 6);
                break;
            case prisma_1.BillingCycle.ANNUAL:
                end.setFullYear(end.getFullYear() + 1);
                break;
        }
        return end;
    }
}
exports.BillingEngine = BillingEngine;
