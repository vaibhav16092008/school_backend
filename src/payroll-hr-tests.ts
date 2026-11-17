import { createApp } from './app';
import {
  prisma,
  Role,
  UserStatus,
  EmploymentType,
  EmploymentStatus,
  LeaveStatus,
  ComponentType,
  CalculationType,
  PayrollPeriodStatus,
  PayrollStatus,
  ExpenseStatus,
} from './lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env';
import { Server } from 'http';

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

async function runPayrollHrTests() {
  console.log('================================================================');
  console.log('🚀 PHASE 8 — PAYROLL, HR & EXPENSE MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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
      // Non-json
    }
    return { status: res.status, data, ok: res.ok };
  }

  function makeToken(user: { id: string; email: string; role: Role; schoolId: string | null }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const timestamp = Date.now();

  // Create School A and School B for multi-tenancy verification
  const schoolA = await prisma.schools.create({
    data: {
      name: `Springfield Academy Phase 8 A ${timestamp}`,
      code: `SP8A_${timestamp}`,
      email: `admin_p8a_${timestamp}@test.com`,
      status: 'ACTIVE',
    },
  });

  const schoolB = await prisma.schools.create({
    data: {
      name: `Shelbyville Grammar Phase 8 B ${timestamp}`,
      code: `SP8B_${timestamp}`,
      email: `admin_p8b_${timestamp}@test.com`,
      status: 'ACTIVE',
    },
  });

  // Admin A & Admin B
  const adminA = await prisma.users.create({
    data: {
      schoolId: schoolA.id,
      email: `adminA_${timestamp}@schoola.test`,
      passwordHash,
      name: 'Admin A',
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const adminB = await prisma.users.create({
    data: {
      schoolId: schoolB.id,
      email: `adminB_${timestamp}@schoolb.test`,
      passwordHash,
      name: 'Admin B',
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const tokenAdminA = makeToken(adminA);
  const tokenAdminB = makeToken(adminB);

  // Variable holders for tests
  let deptAId = '';
  let desigAId = '';
  let employeeAId = '';
  let employeeTeacherAUser: any = null;
  let employeeTeacherAToken = '';
  let employeeTeacherBUser: any = null;
  let employeeTeacherBToken = '';
  let leaveTypePaidId = '';
  let leaveTypeUnpaidId = '';
  let leaveAppId = '';
  let salaryStructureId = '';
  let payrollPeriodId = '';
  let payrollRecordId = '';
  let payslipId = '';
  let expenseCatId = '';
  let expenseId = '';

  try {
    // -------------------------------------------------------------
    // TEST 1: Department & Designation creation with Tenant Isolation
    // -------------------------------------------------------------
    {
      const deptRes = await api('/school/hr/departments', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          name: 'Science Department',
          code: `SCI_${timestamp}`,
          description: 'Science and Research',
        },
      });

      const desigRes = await api('/school/hr/designations', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          title: 'Senior Physics Lecturer',
          code: `SPL_${timestamp}`,
          description: 'Teaches higher secondary physics',
        },
      });

      deptAId = deptRes.data?.data?.id;
      desigAId = desigRes.data?.data?.id;

      // School B admin attempts to read School A's departments
      const listResB = await api('/school/hr/departments', {
        token: tokenAdminB,
      });

      const deptFoundInB = listResB.data?.data?.some((d: any) => d.id === deptAId);

      const passed =
        deptRes.status === 201 &&
        desigRes.status === 201 &&
        !deptFoundInB &&
        deptRes.data?.data?.schoolId === schoolA.id;

      recordTest(
        1,
        'Multi-tenant Department & Designation Creation',
        passed,
        `Created Dept (${deptAId}) & Desig (${desigAId}) in School A; School B list isolated: ${!deptFoundInB}`
      );
    }

    // -------------------------------------------------------------
    // TEST 2: Employee Onboarding with User, Teacher, Profile, Leave Balances
    // -------------------------------------------------------------
    {
      // First create a leave type for School A so onboarding auto-allocates balance
      const leaveTypeRes = await api('/school/leave/types', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          name: 'Paid Annual Leave',
          code: `AL_${timestamp}`,
          daysAllowed: 15,
          isPaid: true,
          carryForward: true,
        },
      });
      leaveTypePaidId = leaveTypeRes.data?.data?.id;

      const onboardRes = await api('/school/hr/employees/onboard', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          email: `emp_teacherA_${timestamp}@schoola.test`,
          password: 'Password123!',
          firstName: 'Robert',
          lastName: 'Oppenheimer',
          phone: '+15551234567',
          employeeId: `EMP_${timestamp}_001`,
          departmentId: deptAId,
          designationId: desigAId,
          employmentType: 'PERMANENT',
          joiningDate: new Date('2025-01-10').toISOString(),
          emergencyContactName: 'Katherine Oppenheimer',
          emergencyContactPhone: '+15559876543',
          emergencyContactRelation: 'Spouse',
        },
      });

      employeeAId = onboardRes.data?.data?.profile?.id;
      const teacherId = onboardRes.data?.data?.teacher?.id;
      const userId = onboardRes.data?.data?.user?.id;

      employeeTeacherAUser = await prisma.users.findUnique({ where: { id: userId } });
      employeeTeacherAToken = makeToken(employeeTeacherAUser);

      // Verify leave balance was auto-initialized
      const leaveBalances = await prisma.leave_balances.findMany({
        where: { employeeProfileId: employeeAId, schoolId: schoolA.id },
      });

      const passed =
        onboardRes.status === 201 &&
        !!employeeAId &&
        !!teacherId &&
        leaveBalances.length > 0 &&
        leaveBalances[0].allocated === 15;

      recordTest(
        2,
        'Employee Onboarding with Profile & Leave Allocation',
        passed,
        `Onboarded employee ${employeeAId}, initialized ${leaveBalances.length} leave balance record(s)`
      );
    }

    // -------------------------------------------------------------
    // TEST 3: Multi-tenant Anti-IDOR for Employee Profiles
    // -------------------------------------------------------------
    {
      // School B admin attempts to read School A's employee profile
      const crossReadRes = await api(`/school/hr/employees/${employeeAId}`, {
        token: tokenAdminB,
      });

      // School B admin attempts to update School A's employee profile
      const crossUpdateRes = await api(`/school/hr/employees/${employeeAId}`, {
        method: 'PUT',
        token: tokenAdminB,
        body: {
          employmentStatus: 'TERMINATED',
        },
      });

      const passed =
        crossReadRes.status === 404 &&
        crossUpdateRes.status === 404;

      recordTest(
        3,
        'Employee Profile Cross-Tenant IDOR Protection',
        passed,
        `School B read: ${crossReadRes.status} (expected 404), School B update: ${crossUpdateRes.status} (expected 404)`
      );
    }

    // -------------------------------------------------------------
    // TEST 4: Leave Application, Overlapping Validation & Approval
    // -------------------------------------------------------------
    {
      // Create unpaid leave type
      const unpaidRes = await api('/school/leave/types', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          name: 'Unpaid Leave',
          code: `UL_${timestamp}`,
          daysAllowed: 10,
          isPaid: false,
        },
      });
      leaveTypeUnpaidId = unpaidRes.data?.data?.id;

      // Employee applies for leave: Nov 20 to Nov 22 (3 days)
      const startDate = new Date('2026-11-20T00:00:00.000Z').toISOString();
      const endDate = new Date('2026-11-22T00:00:00.000Z').toISOString();

      const appRes = await api('/employee/leave-applications', {
        method: 'POST',
        token: employeeTeacherAToken,
        body: {
          leaveTypeId: leaveTypePaidId,
          startDate,
          endDate,
          reason: 'Academic physics conference presentation',
        },
      });

      leaveAppId = appRes.data?.data?.id;

      // Attempt overlapping leave: Nov 21 to Nov 24
      const overlapStartDate = new Date('2026-11-21T00:00:00.000Z').toISOString();
      const overlapEndDate = new Date('2026-11-24T00:00:00.000Z').toISOString();

      const overlapRes = await api('/employee/leave-applications', {
        method: 'POST',
        token: employeeTeacherAToken,
        body: {
          leaveTypeId: leaveTypePaidId,
          startDate: overlapStartDate,
          endDate: overlapEndDate,
          reason: 'Overlapping request test',
        },
      });

      // Admin approves the first leave application
      const approveRes = await api(`/school/leave/applications/${leaveAppId}/review`, {
        method: 'POST',
        token: tokenAdminA,
        body: {
          status: 'APPROVED',
          rejectionReason: '',
        },
      });

      // Check updated balance
      const balanceAfter = await prisma.leave_balances.findFirst({
        where: { employeeProfileId: employeeAId, leaveTypeId: leaveTypePaidId },
      });

      const passed =
        appRes.status === 201 &&
        overlapRes.status === 400 &&
        approveRes.status === 200 &&
        approveRes.data?.data?.status === 'APPROVED' &&
        balanceAfter?.used === 3 &&
        balanceAfter?.remaining === 12;

      recordTest(
        4,
        'Leave Application, Overlap Rejection & Approval Balance Deduction',
        passed,
        `Applied 3 days, overlap rejected (${overlapRes.status}), approved: used=${balanceAfter?.used}, remaining=${balanceAfter?.remaining}`
      );
    }

    // -------------------------------------------------------------
    // TEST 5: Salary Structure & Components Configuration
    // -------------------------------------------------------------
    {
      const structRes = await api('/school/payroll/structures', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          name: 'Senior Academic Staff Structure',
          description: 'Standard faculty pay structure',
          baseSalary: 50000,
          components: [
            {
              name: 'House Rent Allowance (HRA)',
              type: 'EARNING',
              calculationType: 'PERCENTAGE',
              percentage: 20, // 20% of base = 10,000
              isTaxable: true,
            },
            {
              name: 'Transport Allowance',
              type: 'EARNING',
              calculationType: 'FLAT',
              flatAmount: 3000,
              isTaxable: false,
            },
            {
              name: 'Provident Fund (PF)',
              type: 'DEDUCTION',
              calculationType: 'PERCENTAGE',
              percentage: 12, // 12% of base = 6,000
              isTaxable: false,
            },
            {
              name: 'Professional Tax',
              type: 'DEDUCTION',
              calculationType: 'FLAT',
              flatAmount: 200,
              isTaxable: false,
            },
          ],
        },
      });

      salaryStructureId = structRes.data?.data?.id;

      // Assign structure to employee
      const assignRes = await api('/school/payroll/structures/assign', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          employeeProfileId: employeeAId,
          salaryStructureId,
          effectiveFrom: new Date('2026-01-01').toISOString(),
        },
      });

      const passed =
        structRes.status === 201 &&
        assignRes.status === 201 &&
        structRes.data?.data?.salary_components?.length === 4;

      recordTest(
        5,
        'Salary Structure Configuration with Percentage & Flat Components',
        passed,
        `Created structure with 4 components, assigned to employee ${employeeAId}`
      );
    }

    // -------------------------------------------------------------
    // TEST 6: Staff Attendance & Unpaid Leave Integration with Payroll
    // -------------------------------------------------------------
    {
      // 1. Create a payroll period for November 2026 (30 days, 22 working days)
      const periodRes = await api('/school/payroll/periods', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          year: 2026,
          month: 11,
          startDate: new Date('2026-11-01').toISOString(),
          endDate: new Date('2026-11-30').toISOString(),
          totalWorkingDays: 22,
        },
      });

      payrollPeriodId = periodRes.data?.data?.id;

      // 2. Record 2 absent days in staff_attendance for teacher
      const teacher = await prisma.teachers.findFirst({
        where: { employee_profiles: { id: employeeAId } },
      });

      if (teacher) {
        await prisma.staff_attendance.createMany({
          data: [
            {
              schoolId: schoolA.id,
              teacherId: teacher.id,
              date: new Date('2026-11-03'),
              status: 'ABSENT',
              remarks: 'Uninformed absence',
            },
            {
              schoolId: schoolA.id,
              teacherId: teacher.id,
              date: new Date('2026-11-04'),
              status: 'ABSENT',
              remarks: 'Uninformed absence',
            },
          ],
        });
      }

      // 3. Generate payroll for the period
      const genRes = await api('/school/payroll/generate', {
        method: 'POST',
        token: tokenAdminA,
        body: { payrollPeriodId },
      });

      const records = genRes.data?.data?.records || [];
      const empRecord = records.find((r: any) => r.employeeProfileId === employeeAId);
      payrollRecordId = empRecord?.id;

      // Calculation check:
      // Base: 50,000
      // Earnings: HRA (20% of 50k = 10,000) + Transport (3000) = 13,000. Gross = 63,000
      // Regular Deductions: PF (12% of 50k = 6,000) + PT (200) = 6,200
      // LOP Deductions: 2 absent days * (50000 / 22) = 2 * 2272.73 = 4545.45
      // Total Deductions = 6,200 + 4545.45 = 10,745.45
      // Net Pay = 63,000 - 10,745.45 = 52,254.55
      const passed =
        periodRes.status === 201 &&
        genRes.status === 200 &&
        empRecord &&
        Number(empRecord.baseSalary) === 50000 &&
        Number(empRecord.grossEarnings) === 63000 &&
        Number(empRecord.absentDays) === 2 &&
        Number(empRecord.netSalary) > 52250 &&
        Number(empRecord.netSalary) < 52260;

      recordTest(
        6,
        'Staff Attendance Integration & Payroll Generation with LOP Deductions',
        passed,
        `Period ${payrollPeriodId} generated: Gross=${empRecord?.grossEarnings}, Absent Days=${empRecord?.absentDays}, Net=${empRecord?.netSalary}`
      );
    }

    // -------------------------------------------------------------
    // TEST 7: Finalized Payroll Immutability
    // -------------------------------------------------------------
    {
      // Finalize the payroll period
      const finalizeRes = await api('/school/payroll/finalize', {
        method: 'POST',
        token: tokenAdminA,
        body: { payrollPeriodId },
      });

      // Attempting to re-generate the finalized period must be rejected
      const regenRes = await api('/school/payroll/generate', {
        method: 'POST',
        token: tokenAdminA,
        body: { payrollPeriodId },
      });

      const periodAfter = await prisma.payroll_periods.findUnique({
        where: { id: payrollPeriodId },
      });

      const passed =
        finalizeRes.status === 200 &&
        periodAfter?.status === 'FINALIZED' &&
        regenRes.status === 400;

      recordTest(
        7,
        'Finalized Payroll Period Immutability & Protection',
        passed,
        `Period finalized (${finalizeRes.status}), regenerate on finalized period blocked (${regenRes.status})`
      );
    }

    // -------------------------------------------------------------
    // TEST 8: Auditable Post-Finalization Adjustment Entry
    // -------------------------------------------------------------
    {
      // Add post-finalization adjustment entry (e.g., Performance Bonus)
      const adjRes = await api('/school/payroll/adjustments', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          payrollRecordId,
          type: 'EARNING',
          amount: 5000,
          reason: 'Annual Research Grant Award',
        },
      });

      // Verify record and adjustment
      const recordAfter = await prisma.payroll_records.findUnique({
        where: { id: payrollRecordId },
        include: { payroll_adjustments: true },
      });

      const adj = recordAfter?.payroll_adjustments.find(
        (a) => a.reason === 'Annual Research Grant Award'
      );

      const passed =
        adjRes.status === 201 &&
        !!adj &&
        Number(adj.amount) === 5000 &&
        adj.adjustedById === adminA.id;

      recordTest(
        8,
        'Auditable Post-Finalization Payroll Adjustment Entry',
        passed,
        `Recorded adjustment of $5000 by admin ${adminA.id}: ${adj?.reason}`
      );
    }

    // -------------------------------------------------------------
    // TEST 9: Payslip Generation & Anti-IDOR Authorization
    // -------------------------------------------------------------
    {
      // Finalization in Test 7 auto-generates payslips
      const payslips = await prisma.payslips.findMany({
        where: { payrollRecordId },
      });
      payslipId = payslips[0]?.id;

      // 1. Employee A accesses their own payslip -> 200 OK
      const selfRes = await api(`/employee/payslips/${payslipId}`, {
        token: employeeTeacherAToken,
      });

      // 2. Create another teacher in School A (Teacher B)
      const teacherBUser = await prisma.users.create({
        data: {
          schoolId: schoolA.id,
          email: `teacherB_${timestamp}@schoola.test`,
          passwordHash,
          name: 'Teacher B',
          role: Role.TEACHER,
          status: UserStatus.ACTIVE,
        },
      });
      const teacherB = await prisma.teachers.create({
        data: {
          schoolId: schoolA.id,
          userId: teacherBUser.id,
          firstName: 'Enrico',
          lastName: 'Fermi',
          employeeId: `EMP_${timestamp}_002`,
          email: teacherBUser.email,
        },
      });
      await prisma.employee_profiles.create({
        data: {
          schoolId: schoolA.id,
          teacherId: teacherB.id,
          departmentId: deptAId,
          designationId: desigAId,
          employmentType: 'PERMANENT',
          employmentStatus: 'ACTIVE',
          joiningDate: new Date('2025-06-01'),
        },
      });
      employeeTeacherBToken = makeToken(teacherBUser);

      // Teacher B attempts to view Teacher A's payslip -> 403 Forbidden
      const idorRes = await api(`/employee/payslips/${payslipId}`, {
        token: employeeTeacherBToken,
      });

      // Cross-tenant access: School B admin attempts to view Teacher A's payslip -> 404 Not Found
      const crossTenantRes = await api(`/school/payroll/payslips/${payslipId}`, {
        token: tokenAdminB,
      });

      const passed =
        selfRes.status === 200 &&
        idorRes.status === 403 &&
        crossTenantRes.status === 404 &&
        selfRes.data?.data?.payslipNumber?.length > 0;

      recordTest(
        9,
        'Payslip Generation & Strict Anti-IDOR Authorization',
        passed,
        `Self-access: ${selfRes.status} (OK), IDOR other employee: ${idorRes.status} (403 Forbidden), Cross-tenant: ${crossTenantRes.status} (404)`
      );
    }

    // -------------------------------------------------------------
    // TEST 10: Expense Management & Multi-step Approval Workflow
    // -------------------------------------------------------------
    {
      // 1. Create Expense Category
      const catRes = await api('/school/expenses/categories', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          name: 'Laboratory Equipment & Consumables',
          code: `LAB_${timestamp}`,
          description: 'Expenses for physics lab supplies',
        },
      });
      expenseCatId = catRes.data?.data?.id;

      // 2. Submit Expense by Teacher A
      const expenseRes = await api('/school/expenses', {
        method: 'POST',
        token: employeeTeacherAToken,
        body: {
          categoryId: expenseCatId,
          departmentId: deptAId,
          title: 'Vacuum Chamber Flanges & Gaskets',
          description: 'Procured for laboratory high-vacuum experimental setup',
          amount: 450.75,
          expenseDate: new Date('2026-11-12').toISOString(),
          paymentMethod: 'REIMBURSEMENT',
          vendor: 'MDC Vacuum Products',
        },
      });
      expenseId = expenseRes.data?.data?.id;

      // 3. Admin A Reviews & Approves Expense
      const reviewRes = await api(`/school/expenses/${expenseId}/review`, {
        method: 'POST',
        token: tokenAdminA,
        body: {
          status: 'APPROVED',
          comment: 'Approved per department budget approval matrix',
        },
      });

      // 4. Mark Expense as Paid
      const paidRes = await api(`/school/expenses/${expenseId}/mark-paid`, {
        method: 'POST',
        token: tokenAdminA,
        body: {
          paymentReference: `TXN_EXP_${timestamp}`,
        },
      });

      // 5. Check Finance Summary
      const summaryRes = await api('/school/expenses/summary', {
        token: tokenAdminA,
      });

      const passed =
        catRes.status === 201 &&
        expenseRes.status === 201 &&
        reviewRes.status === 200 &&
        paidRes.status === 200 &&
        paidRes.data?.data?.status === 'PAID' &&
        summaryRes.status === 200 &&
        summaryRes.data?.data?.totalExpenses >= 450.75;

      recordTest(
        10,
        'Expense Submission, Approval Workflow & Payment Tracking',
        passed,
        `Submitted expense $450.75, approved by admin, marked paid with ref ${paidRes.data?.data?.paymentReference}`
      );
    }

    // -------------------------------------------------------------
    // TEST 11: Phase 7 Notification Event Triggers Dispatch
    // -------------------------------------------------------------
    {
      // Check notification logs in DB for Phase 8 events triggered during earlier steps:
      // LEAVE_APPLICATION_SUBMITTED, LEAVE_STATUS_UPDATED, PAYROLL_GENERATED, PAYSLIP_PUBLISHED, EXPENSE_SUBMITTED, EXPENSE_STATUS_UPDATED
      const notifications = await prisma.notifications.findMany({
        where: {
          schoolId: schoolA.id,
          eventType: {
            in: [
              'LEAVE_APPLICATION_SUBMITTED',
              'LEAVE_STATUS_UPDATED',
              'PAYROLL_GENERATED',
              'PAYSLIP_PUBLISHED',
              'EXPENSE_SUBMITTED',
              'EXPENSE_STATUS_UPDATED',
            ],
          },
        },
      });

      const eventTypesFound = Array.from(new Set(notifications.map((n) => n.eventType)));

      const passed =
        notifications.length > 0 &&
        eventTypesFound.includes('LEAVE_APPLICATION_SUBMITTED') &&
        eventTypesFound.includes('PAYROLL_GENERATED');

      recordTest(
        11,
        'ERP Notification Triggers Dispatch for HR, Payroll & Expenses',
        passed,
        `Dispatched ${notifications.length} notifications across events: ${eventTypesFound.join(', ')}`
      );
    }

    // -------------------------------------------------------------
    // TEST 12: Input Validation Rejection on Invalid Requests
    // -------------------------------------------------------------
    {
      // Negative salary base
      const badSalary = await api('/school/payroll/structures', {
        method: 'POST',
        token: tokenAdminA,
        body: {
          name: 'Invalid Structure',
          baseSalary: -1000,
        },
      });

      // End date before start date in leave
      const badLeaveDate = await api('/employee/leave-applications', {
        method: 'POST',
        token: employeeTeacherAToken,
        body: {
          leaveTypeId: leaveTypePaidId,
          startDate: '2026-12-10T00:00:00.000Z',
          endDate: '2026-12-05T00:00:00.000Z',
          reason: 'Invalid chronological dates',
        },
      });

      // Invalid expense amount
      const badExpense = await api('/school/expenses', {
        method: 'POST',
        token: employeeTeacherAToken,
        body: {
          categoryId: expenseCatId,
          title: 'Negative Expense',
          amount: -50,
          expenseDate: new Date().toISOString(),
        },
      });

      const passed =
        badSalary.status === 400 &&
        badLeaveDate.status === 400 &&
        badExpense.status === 400;

      recordTest(
        12,
        'Input Validation & Rejection for Invalid Requests',
        passed,
        `Negative salary rejected (${badSalary.status}), inverted leave dates rejected (${badLeaveDate.status}), negative expense rejected (${badExpense.status})`
      );
    }
  } catch (error: any) {
    console.error('Fatal error during test execution:', error);
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log('================================================================');
  const allPassed = results.length === 12 && results.every((r) => r.passed);
  console.log(`Total Tests : ${results.length}`);
  console.log(`Passed      : ${results.filter((r) => r.passed).length}`);
  console.log(`Failed      : ${results.filter((r) => !r.passed).length}`);
  console.log(`Status      : ${allPassed ? '🎉 ALL 12 TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runPayrollHrTests().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
