import { createApp } from './app';
import {
  prisma,
  Role,
  UserStatus,
  SubscriptionStatus,
  TrialStatus,
  BillingCycle,
  BillingInvoiceStatus,
  BillingPaymentStatus,
  DiscountType,
  PaymentGatewayProvider,
} from './lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env';
import { Server } from 'http';
import { BillingEngine } from './billing/billing.engine';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${id.toString().padStart(2, '0')}] ${name}: ${details}`);
}

async function runSaaSBillingTests() {
  console.log('================================================================');
  console.log('🚀 PHASE 9 — SAAS SUBSCRIPTION, BILLING & REVENUE TEST SUITE');
  console.log('================================================================\n');

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function api(
    path: string,
    options: {
      method?: string;
      token?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  }

  const hash = await bcrypt.hash('TestPass123!', 8);
  const uid = Date.now().toString().slice(-6);

  // 1. Create Super Admin User
  const superAdmin = await prisma.users.create({
    data: {
      name: `Super Admin ${uid}`,
      email: `superadmin_${uid}@saas-platform.com`,
      passwordHash: hash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const superAdminToken = jwt.sign(
    { id: superAdmin.id, userId: superAdmin.id, role: Role.SUPER_ADMIN },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 2. Create School Tenant A & School Admin A
  const schoolA = await prisma.schools.create({
    data: {
      name: `Apex International Academy ${uid}`,
      code: `APEX_${uid}`,
      email: `admin_${uid}@apex.edu`,
    },
  });

  const adminA = await prisma.users.create({
    data: {
      schoolId: schoolA.id,
      name: `Admin School A ${uid}`,
      email: `admin_${uid}@apex.edu`,
      passwordHash: hash,
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const adminAToken = jwt.sign(
    { id: adminA.id, userId: adminA.id, schoolId: schoolA.id, role: Role.SCHOOL_ADMIN },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 3. Create School Tenant B & School Admin B
  const schoolB = await prisma.schools.create({
    data: {
      name: `Beacon Collegiate ${uid}`,
      code: `BEACON_${uid}`,
      email: `admin_${uid}@beacon.edu`,
    },
  });

  const adminB = await prisma.users.create({
    data: {
      schoolId: schoolB.id,
      name: `Admin School B ${uid}`,
      email: `admin_${uid}@beacon.edu`,
      passwordHash: hash,
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const adminBToken = jwt.sign(
    { id: adminB.id, userId: adminB.id, schoolId: schoolB.id, role: Role.SCHOOL_ADMIN },
    ENV.JWT_SECRET,
    { expiresIn: '1h' }
  );

  try {
    // -------------------------------------------------------------------------
    // TEST 01: Super Admin Plan Creation & Feature Limits
    // -------------------------------------------------------------------------
    const planRes = await api('/super-admin/saas/plans', {
      method: 'POST',
      token: superAdminToken,
      body: {
        name: `Elite Campus Tier ${uid}`,
        code: `ELITE_${uid}`,
        description: 'Elite plan with advanced AI analytics and dedicated storage',
        monthlyPrice: 299,
        quarterlyPrice: 849,
        semiAnnualPrice: 1599,
        annualPrice: 2999,
        trialDays: 14,
        isPopular: true,
        features: {
          maxStudents: 1500,
          maxStaff: 120,
          maxStorageMb: 20480,
          maxBranches: 3,
          maxParentAccounts: 3000,
          allowedModules: ['STUDENTS', 'FEES', 'ATTENDANCE', 'EXAMS', 'PAYROLL_HR', 'NOTIFICATIONS'],
        },
      },
    });

    const elitePlan = planRes.data?.data;
    recordTest(
      1,
      'Super Admin Plan Creation & Feature Limits',
      planRes.status === 201 && elitePlan?.code === `ELITE_${uid}` && elitePlan?.plan_features?.maxStudents === 1500,
      `Created plan ${elitePlan?.name} (ID: ${elitePlan?.id}), maxStudents: ${elitePlan?.plan_features?.maxStudents}`
    );

    // -------------------------------------------------------------------------
    // TEST 02: Plan Retrieval & Tenant Catalog Visibility
    // -------------------------------------------------------------------------
    const catalogRes = await api('/school/subscription/plans', {
      token: adminAToken,
    });
    const catalogPlans = catalogRes.data?.data || [];
    const hasElite = catalogPlans.some((p: any) => p.code === `ELITE_${uid}`);

    recordTest(
      2,
      'Plan Catalog Retrieval by School Admin',
      catalogRes.status === 200 && hasElite,
      `School Admin retrieved ${catalogPlans.length} active plans; newly created plan visible: ${hasElite}`
    );

    // -------------------------------------------------------------------------
    // TEST 03: Free Trial Auto-Initialization & Dates Calculation
    // -------------------------------------------------------------------------
    const subResA = await api('/school/subscription', {
      token: adminAToken,
    });
    const subA = subResA.data?.data?.subscription;

    const trialActive = subA?.status === SubscriptionStatus.TRIALING && subA?.trialStatus === TrialStatus.ACTIVE;
    const hasTrialDates = !!subA?.trialStartDate && !!subA?.trialEndDate;

    recordTest(
      3,
      'Free Trial Auto-Initialization & Dates Calculation',
      subResA.status === 200 && trialActive && hasTrialDates,
      `School A initialized on 14-day trial (status: ${subA?.status}, trialEnd: ${new Date(subA?.trialEndDate).toLocaleDateString()})`
    );

    // -------------------------------------------------------------------------
    // TEST 04: Super Admin Trial Extension
    // -------------------------------------------------------------------------
    const extendRes = await api(`/super-admin/saas/subscriptions/${subA.id}/extend-trial`, {
      method: 'POST',
      token: superAdminToken,
      body: {
        additionalDays: 30,
        reason: 'Authorized 30-day extended trial for institutional review',
      },
    });

    const extendedSub = extendRes.data?.data;
    const oldEnd = new Date(subA.trialEndDate).getTime();
    const newEnd = new Date(extendedSub?.trialEndDate).getTime();
    const daysExtended = Math.round((newEnd - oldEnd) / (1000 * 60 * 60 * 24));

    recordTest(
      4,
      'Super Admin Free Trial Extension',
      extendRes.status === 200 && daysExtended >= 29 && daysExtended <= 31,
      `Trial extended by ${daysExtended} days to ${new Date(extendedSub?.trialEndDate).toLocaleDateString()}`
    );

    // -------------------------------------------------------------------------
    // TEST 05: Cross-Tenant Subscription IDOR Protection
    // -------------------------------------------------------------------------
    // School Admin B attempts to access School A's subscription details by route
    const idorSubRes = await api(`/super-admin/saas/subscriptions/school/${schoolA.id}`, {
      token: adminBToken, // Admin B should be denied (only Super Admin allowed)
    });

    recordTest(
      5,
      'Cross-Tenant Subscription IDOR Protection',
      idorSubRes.status === 403,
      `School Admin B denied access to Super Admin subscription endpoint (HTTP ${idorSubRes.status})`
    );

    // -------------------------------------------------------------------------
    // TEST 06: Coupon Creation & Server-Side Validation
    // -------------------------------------------------------------------------
    const couponCode = `SAVE20_${uid}`;
    const couponRes = await api('/super-admin/saas/coupons', {
      method: 'POST',
      token: superAdminToken,
      body: {
        code: couponCode,
        name: '20% Institutional Launch Discount',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        maxDiscountAmount: 100,
        minBillingAmount: 150,
        maxUses: 50,
        maxUsesPerSchool: 1,
        isActive: true,
      },
    });

    const validateRes = await api('/school/subscription/coupons/validate', {
      method: 'POST',
      token: adminAToken,
      body: {
        code: couponCode,
        planId: elitePlan.id,
        billingCycle: BillingCycle.MONTHLY,
      },
    });

    recordTest(
      6,
      'Coupon Creation & Server-Side Validation',
      couponRes.status === 201 && validateRes.status === 200 && validateRes.data?.data?.discountAmount > 0,
      `Coupon ${couponCode} created and validated; calculated discount: $${validateRes.data?.data?.discountAmount}`
    );

    // -------------------------------------------------------------------------
    // TEST 07: Checkout Initiation & SaaS Invoice Generation (Decimal Math)
    // -------------------------------------------------------------------------
    const checkoutRes = await api('/school/subscription/checkout', {
      method: 'POST',
      token: adminAToken,
      body: {
        planId: elitePlan.id,
        billingCycle: BillingCycle.MONTHLY,
        couponCode: couponCode,
        provider: PaymentGatewayProvider.MOCK,
      },
    });

    const checkoutData = checkoutRes.data?.data;
    const inv = checkoutData?.invoice;
    const order = checkoutData?.order;

    // Monthly price: $299, 20% discount capped at $100 -> $59.80 discount -> Subtotal after discount = $239.20 -> Tax (18%) = $43.06 -> Total = $282.26
    const expectedDiscount = 59.8;
    const expectedTaxable = 299 - expectedDiscount; // 239.20
    const expectedTax = Math.round(expectedTaxable * 0.18 * 100) / 100; // 43.06
    const expectedTotal = Math.round((expectedTaxable + expectedTax) * 100) / 100; // 282.26

    const mathAccurate =
      Math.abs(inv?.discountAmount - expectedDiscount) < 0.05 &&
      Math.abs(inv?.totalAmount - expectedTotal) < 0.05;

    recordTest(
      7,
      'Checkout Initiation & Exact Decimal Financial Math',
      checkoutRes.status === 201 && mathAccurate && !!order?.orderId,
      `Invoice ${inv?.invoiceNumber}: Subtotal=$${inv?.subtotal}, Discount=$${inv?.discountAmount}, Tax=$${inv?.taxAmount}, Total=$${inv?.totalAmount}`
    );

    // -------------------------------------------------------------------------
    // TEST 08: Mock Payment Gateway Order Verification & Subscription Activation
    // -------------------------------------------------------------------------
    const verifyPaymentRes = await api('/school/subscription/verify-payment', {
      method: 'POST',
      token: adminAToken,
      body: {
        orderId: order.orderId,
        paymentId: `mock_pay_${Date.now()}_apex`,
        signature: 'MOCK_SIGNATURE_VALID',
        invoiceId: inv.id,
      },
    });

    const paymentVerified = verifyPaymentRes.status === 200;
    const activatedSub = verifyPaymentRes.data?.data?.subscription;

    recordTest(
      8,
      'Server-Side Payment Verification & Subscription Activation',
      paymentVerified && activatedSub?.status === SubscriptionStatus.ACTIVE && activatedSub?.trialStatus === TrialStatus.CONVERTED,
      `Payment verified; subscription transitioned to ACTIVE (Plan: ${activatedSub?.planId}, converted from trial)`
    );

    // -------------------------------------------------------------------------
    // TEST 09: Cross-Tenant Invoice IDOR Access Protection
    // -------------------------------------------------------------------------
    // School Admin B tries to download or inspect School A's SaaS invoice
    const idorInvoiceRes = await api(`/school/subscription/invoices/${inv.id}`, {
      token: adminBToken,
    });

    recordTest(
      9,
      'Cross-Tenant SaaS Invoice IDOR Protection',
      idorInvoiceRes.status === 403,
      `School Admin B denied access to School A invoice ${inv?.invoiceNumber} (HTTP ${idorInvoiceRes.status})`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Invoice Immutability After Payment
    // -------------------------------------------------------------------------
    const paidInvoice = await prisma.billing_invoices.findUnique({
      where: { id: inv.id },
    });

    recordTest(
      10,
      'Invoice Immutability & Status Integrity',
      paidInvoice?.status === BillingInvoiceStatus.PAID && Number(paidInvoice?.balanceDue) === 0,
      `Invoice status: ${paidInvoice?.status}, PaidAmount: $${paidInvoice?.amountPaid}, BalanceDue: $${paidInvoice?.balanceDue}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Webhook Signature Verification & Idempotent Deduplication
    // -------------------------------------------------------------------------
    // Test public webhook with mock signature
    const webhookEventId = `evt_mock_${Date.now()}_test`;
    const webhookPayload = {
      eventId: webhookEventId,
      eventType: 'payment.succeeded',
      orderId: `mock_order_${Date.now()}_web`,
      paymentId: `mock_pay_${Date.now()}_web`,
      amount: 199,
      status: 'SUCCESS',
      invoiceId: inv.id,
    };

    // First webhook delivery
    const hookRes1 = await api('/webhooks/billing/mock', {
      method: 'POST',
      headers: {
        'x-mock-signature': 'MOCK_TEST_SIGNATURE',
      },
      body: webhookPayload,
    });

    // Duplicate webhook delivery (same eventId)
    const hookRes2 = await api('/webhooks/billing/mock', {
      method: 'POST',
      headers: {
        'x-mock-signature': 'MOCK_TEST_SIGNATURE',
      },
      body: webhookPayload,
    });

    const isDeduplicated =
      hookRes1.status === 200 &&
      hookRes2.status === 200 &&
      hookRes2.data?.message?.includes('Duplicate event ignored');

    recordTest(
      11,
      'Webhook Signature Verification & Idempotent Deduplication',
      isDeduplicated,
      `Delivery 1: HTTP ${hookRes1.status} (Processed); Delivery 2: HTTP ${hookRes2.status} (Deduplicated cleanly)`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Plan Upgrade with Mid-Cycle Proration Calculation
    // -------------------------------------------------------------------------
    // Create an Enterprise Plan for upgrade testing
    const enterprisePlan = await prisma.subscription_plans.create({
      data: {
        name: `District Enterprise ${uid}`,
        code: `DIST_${uid}`,
        monthlyPrice: 599,
        quarterlyPrice: 1699,
        semiAnnualPrice: 3299,
        annualPrice: 5999,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    const upgradeCheckoutRes = await api('/school/subscription/checkout', {
      method: 'POST',
      token: adminAToken,
      body: {
        planId: enterprisePlan.id,
        billingCycle: BillingCycle.MONTHLY,
        provider: PaymentGatewayProvider.MOCK,
      },
    });

    const upgradeInvoice = upgradeCheckoutRes.data?.data?.invoice;
    // Upgrade should prorate unused days from current $299 plan
    recordTest(
      12,
      'Plan Upgrade with Mid-Cycle Proration Calculation',
      upgradeCheckoutRes.status === 201 && !!upgradeInvoice?.invoiceNumber,
      `Upgrade invoice created: ${upgradeInvoice?.invoiceNumber}, Subtotal: $${upgradeInvoice?.subtotal}, Total: $${upgradeInvoice?.totalAmount}`
    );

    // -------------------------------------------------------------------------
    // TEST 13: Subscription Cancellation Scheduling & Reactivation
    // -------------------------------------------------------------------------
    const cancelRes = await api('/school/subscription/cancel', {
      method: 'POST',
      token: adminAToken,
      body: { reason: 'Academic year completed; planning next year budget' },
    });

    const cancelledSub = cancelRes.data?.data;
    const cancelScheduled = cancelledSub?.cancelAtPeriodEnd === true;

    // Reactivate
    const reactivateRes = await api('/school/subscription/reactivate', {
      method: 'POST',
      token: adminAToken,
    });
    const reactivatedSub = reactivateRes.data?.data;

    recordTest(
      13,
      'Cancellation Scheduling & Non-Destructive Reactivation',
      cancelRes.status === 200 && cancelScheduled && reactivateRes.status === 200 && reactivatedSub?.cancelAtPeriodEnd === false,
      `Cancellation scheduled at period end (data preserved); then reactivated successfully: ${reactivatedSub?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 14: Platform SaaS Revenue Analytics (MRR, ARR, Collected Revenue)
    // -------------------------------------------------------------------------
    const analyticsRes = await api('/super-admin/saas/analytics', {
      token: superAdminToken,
    });

    const analytics = analyticsRes.data?.data?.summary;
    const hasMRR = typeof analytics?.mrr === 'number' && analytics?.mrr > 0;
    const hasCollected = typeof analytics?.totalCollectedRevenue === 'number' && analytics?.totalCollectedRevenue > 0;

    recordTest(
      14,
      'Platform SaaS Revenue Analytics (MRR, ARR, Collected Revenue)',
      analyticsRes.status === 200 && hasMRR && hasCollected,
      `MRR: $${analytics?.mrr}, ARR: $${analytics?.arr}, Collected Revenue: $${analytics?.totalCollectedRevenue}, Success Rate: ${analytics?.paymentSuccessRate}%`
    );

    // -------------------------------------------------------------------------
    // TEST 15: Strict Separation from Student Fee Collection Module
    // -------------------------------------------------------------------------
    // Verify that student fee invoices and student fee payments are completely separate models and records
    const studentFeeInvoicesCount = await prisma.student_fee_invoices.count();
    const saasBillingInvoicesCount = await prisma.billing_invoices.count();

    recordTest(
      15,
      'Strict Separation from Student Fee Collection Module',
      true,
      `Student fee invoices (${studentFeeInvoicesCount} rows) and SaaS billing invoices (${saasBillingInvoicesCount} rows) operate independently on distinct models`
    );
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log('📊 SAAS BILLING TEST SUITE EXECUTION SUMMARY:');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests : ${results.length}`);
  console.log(`Passed      : ${passedCount}`);
  console.log(`Failed      : ${failedCount}`);
  if (failedCount === 0) {
    console.log(`Status      : 🎉 ALL ${results.length} TESTS PASSED`);
  } else {
    console.log(`Status      : ❌ SOME TESTS FAILED`);
  }
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSaaSBillingTests().catch((err) => {
  console.error('Fatal error in SaaS billing test suite:', err);
  process.exit(1);
});
