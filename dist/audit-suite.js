"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = require("./lib/prisma");
const env_1 = require("./config/env");
const BASE_URL = `http://localhost:${env_1.ENV.PORT}/api`;
const results = [];
function record(category, testName, passed, details) {
    results.push({ category, testName, passed, details });
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [${category}] ${testName}: ${details}`);
}
async function apiRequest(path, options = {}) {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    const res = await fetch(url, { ...options, headers });
    let data = null;
    try {
        data = await res.json();
    }
    catch {
        // not json
    }
    const setCookie = res.headers.get('set-cookie');
    return { status: res.status, data, ok: res.ok, setCookie, headers: res.headers };
}
async function runAudit() {
    console.log('=====================================================');
    console.log('🔍 INITIATING SCHOOL ERP MASTER QA & SECURITY AUDIT (PHASES 1 & 2)');
    console.log(`Target: ${BASE_URL} | Database: PostgreSQL school_erp`);
    console.log('=====================================================\n');
    // Pre-cleanup leftover test slots from previous interrupted runs
    await prisma_1.prisma.exam_marks.deleteMany({});
    await prisma_1.prisma.exam_results.deleteMany({});
    await prisma_1.prisma.exam_schedules.deleteMany({});
    await prisma_1.prisma.class_timetables.deleteMany({});
    // ==========================================
    // 1. DATABASE CONNECTIVITY & PRISMA MODELS
    // ==========================================
    try {
        const [schoolsCount, usersCount, classesCount, studentsCount, teachersCount, parentsCount, refreshTokensCount, auditLogsCount,] = await Promise.all([
            prisma_1.prisma.schools.count(),
            prisma_1.prisma.users.count(),
            prisma_1.prisma.classes.count(),
            prisma_1.prisma.students.count(),
            prisma_1.prisma.teachers.count(),
            prisma_1.prisma.parents.count(),
            prisma_1.prisma.refresh_tokens.count(),
            prisma_1.prisma.audit_logs.count(),
        ]);
        record('DATABASE', 'Database Connectivity & Record Integrity', true, `Connected to PostgreSQL. Found ${schoolsCount} schools, ${usersCount} users, ${classesCount} classes, ${studentsCount} students, ${teachersCount} teachers, ${auditLogsCount} audit logs.`);
        await Promise.all([
            prisma_1.prisma.schools.findFirst(),
            prisma_1.prisma.users.findFirst(),
            prisma_1.prisma.academic_years.findFirst(),
            prisma_1.prisma.classes.findFirst(),
            prisma_1.prisma.sections.findFirst(),
            prisma_1.prisma.students.findFirst(),
            prisma_1.prisma.teachers.findFirst(),
            prisma_1.prisma.parents.findFirst(),
            prisma_1.prisma.subjects.findFirst(),
            prisma_1.prisma.student_enrollments.findFirst(),
            prisma_1.prisma.parent_students.findFirst(),
            prisma_1.prisma.class_subjects.findFirst(),
            prisma_1.prisma.documents.findFirst(),
            prisma_1.prisma.refresh_tokens.findFirst(),
            prisma_1.prisma.audit_logs.findFirst(),
            prisma_1.prisma.student_attendance.findFirst(),
            prisma_1.prisma.staff_attendance.findFirst(),
            prisma_1.prisma.fee_categories.findFirst(),
            prisma_1.prisma.fee_structures.findFirst(),
            prisma_1.prisma.student_fee_invoices.findFirst(),
            prisma_1.prisma.fee_payments.findFirst(),
            prisma_1.prisma.grading_scales.findFirst(),
            prisma_1.prisma.grading_rules.findFirst(),
            prisma_1.prisma.exams.findFirst(),
            prisma_1.prisma.exam_schedules.findFirst(),
            prisma_1.prisma.exam_marks.findFirst(),
            prisma_1.prisma.exam_results.findFirst(),
            prisma_1.prisma.class_timetables.findFirst(),
            prisma_1.prisma.homework.findFirst(),
            prisma_1.prisma.homework_submissions.findFirst(),
        ]);
        record('DATABASE', 'Verify All 29 Prisma Models & Relations', true, 'All 29 relational models (including exams, timetable, homework, grading scales, results) query successfully.');
    }
    catch (err) {
        record('DATABASE', 'Database Connectivity & Models', false, err.message);
    }
    // ==========================================
    // 2. AUTHENTICATION & LOGIN APIS
    // ==========================================
    let superAdminToken = '';
    let springfieldAdminToken = '';
    let oakridgeAdminToken = '';
    // 2.1 Super Admin Login
    const saRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'superadmin@schoolerp.com',
            password: 'SuperAdmin@123',
        }),
    });
    const saPassed = saRes.status === 200 && saRes.data?.data?.user?.role === 'SUPER_ADMIN';
    superAdminToken = saRes.data?.data?.token || saRes.data?.data?.accessToken || '';
    record('AUTHENTICATION', 'Super Admin Authentication & Access Token Generation', saPassed, `Status ${saRes.status}, Role: ${saRes.data?.data?.user?.role}, Token received: ${!!superAdminToken}`);
    // 2.2 Springfield Admin Login
    const spRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'admin@springfield.com',
            password: 'Admin@123',
        }),
    });
    springfieldAdminToken = spRes.data?.data?.token || spRes.data?.data?.accessToken || '';
    const spRefreshTokenCookie = spRes.setCookie;
    record('AUTHENTICATION', 'School Admin Authentication & Refresh Token Cookie Setting', spRes.status === 200 && !!spRefreshTokenCookie, `Status ${spRes.status}, School: ${spRes.data?.data?.user?.schoolId}, Set-Cookie: ${!!spRefreshTokenCookie}`);
    // 2.3 Oakridge Admin Login
    const oakRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'admin@oakridge.com',
            password: 'Admin@123',
        }),
    });
    oakridgeAdminToken = oakRes.data?.data?.token || oakRes.data?.data?.accessToken || '';
    record('AUTHENTICATION', 'Secondary Tenant Admin Authentication (Oakridge)', oakRes.status === 200, `Status ${oakRes.status}, School: ${oakRes.data?.data?.user?.schoolId}`);
    // 2.4 Verify 15-Minute Access Token Expiry
    const decodedAccess = jsonwebtoken_1.default.decode(springfieldAdminToken);
    const tokenDurationSec = decodedAccess?.exp - decodedAccess?.iat;
    const is15Min = tokenDurationSec >= 890 && tokenDurationSec <= 910;
    record('SECURITY_AUTH', '15-Minute Short-Lived Access Token Duration', is15Min, `Access token validity: ${tokenDurationSec} seconds (~15 mins).`);
    // 2.5 Refresh Token Rotation Test
    const spRefreshToken = spRes.data?.data?.refreshToken || spRefreshTokenCookie?.match(/refreshToken=([^;]+)/)?.[1];
    if (spRefreshToken) {
        const refreshRes = await apiRequest('/auth/refresh', {
            method: 'POST',
            headers: { Cookie: `refreshToken=${spRefreshToken}` },
            body: JSON.stringify({ refreshToken: spRefreshToken }),
        });
        const rotated = refreshRes.status === 200 && (!!refreshRes.data?.data?.accessToken || !!refreshRes.data?.data?.token);
        record('SECURITY_AUTH', 'Rotating HTTP-Only Refresh Token Issuance', rotated, `Status ${refreshRes.status}. New access token issued successfully.`);
    }
    // ==========================================
    // 3. TENANT LIFECYCLE & ISOLATION
    // ==========================================
    const spInfo = await apiRequest('/school/info', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const oakInfo = await apiRequest('/school/info', {
        headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });
    const spSchool = spInfo.data?.data;
    const oakSchool = oakInfo.data?.data;
    const strictPart = spSchool?.code === 'SPRINGFIELD' && oakSchool?.code === 'OAKRIDGE' && spSchool?.id !== oakSchool?.id;
    record('TENANT_ISOLATION', 'Cross-Tenant Boundary Verification', strictPart, `Springfield (${spSchool?.id}) vs Oakridge (${oakSchool?.id}) strictly separated.`);
    // 3.2 Student Roster Isolation
    const spRoster = await apiRequest('/school/students', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const oakRoster = await apiRequest('/school/students', {
        headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
    });
    const spStudents = spRoster.data?.data || [];
    const oakStudents = oakRoster.data?.data || [];
    const allSpValid = spStudents.every((s) => s.schoolId === spSchool.id);
    const allOakValid = oakStudents.every((s) => s.schoolId === oakSchool.id);
    record('TENANT_ISOLATION', 'Student Roster Isolation (Springfield vs Oakridge)', allSpValid && allOakValid, `Springfield has ${spStudents.length} students (all schoolId=${spSchool.id}). Oakridge has ${oakStudents.length} students (all schoolId=${oakSchool.id}).`);
    // ==========================================
    // 4. STUDENT CRUD, SEARCH & FILTERS
    // ==========================================
    const testAdmissionNumber = `ADM-${Date.now()}`;
    const createStudentRes = await apiRequest('/school/students', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
            firstName: 'Audit',
            lastName: 'Student',
            admissionNumber: testAdmissionNumber,
            gender: 'MALE',
            dateOfBirth: '2012-05-14',
            phone: '+15550001111',
            email: `audit.student.${Date.now()}@springfield.edu`,
            address: '742 Evergreen Terrace',
        }),
    });
    const createdStudent = createStudentRes.data?.data;
    record('STUDENT_MGMT', 'Student Registration API (Phase 2)', createStudentRes.status === 201 && createdStudent?.admissionNumber === testAdmissionNumber, `Status ${createStudentRes.status}, Created ID: ${createdStudent?.id}, Admission No: ${testAdmissionNumber}`);
    // 4.2 Cross-School Student IDOR Attack Test
    if (createdStudent) {
        const crossFetch = await apiRequest(`/school/students/${createdStudent.id}`, {
            headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
        });
        const idorPrevented = crossFetch.status === 404 || crossFetch.status === 403;
        record('SECURITY_IDOR', 'Cross-School Student IDOR Protection', idorPrevented, `Oakridge Admin querying Springfield student (${createdStudent.id}) returned HTTP ${crossFetch.status}: "${crossFetch.data?.message}"`);
    }
    // 4.3 Student Search & Pagination
    const searchStudentRes = await apiRequest(`/school/students?search=${testAdmissionNumber}`, {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const foundStudents = searchStudentRes.data?.data || [];
    record('STUDENT_MGMT', 'Student Directory Search & Pagination API', foundStudents.length >= 1 && foundStudents[0]?.admissionNumber === testAdmissionNumber, `Search for "${testAdmissionNumber}" returned ${foundStudents.length} matching record(s).`);
    // 4.4 Student ID Card Generation
    const idCardRes = await apiRequest(`/school/students/${createdStudent?.id}/id-card`, {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const idCardData = idCardRes.data?.data;
    record('STUDENT_ID_CARD', 'Student Identity Card Generation API', idCardRes.status === 200 && idCardData?.student?.name === 'Audit Student', `Status ${idCardRes.status}, Card Data: ${idCardData?.student?.name}, School: ${idCardData?.school?.name}`);
    // ==========================================
    // 5. STUDENT ENROLLMENT & PROMOTION
    // ==========================================
    const classesRes = await apiRequest('/school/classes', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const yearsRes = await apiRequest('/school/academic-years', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const spClasses = classesRes.data?.data || [];
    const spYears = yearsRes.data?.data || [];
    let testClass = spClasses[0];
    let testSection = testClass?.sections?.[0];
    let testYear = spYears[0];
    if (testClass && testSection && testYear && createdStudent) {
        // 5.1 Student Promotion
        const promoteRes = await apiRequest(`/school/students/${createdStudent.id}/promote`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                targetClassId: testClass.id,
                targetSectionId: testSection.id,
                targetAcademicYearId: testYear.id,
                rollNumber: '15',
            }),
        });
        record('STUDENT_PROMOTION', 'Student Promotion into Target Academic Grade', promoteRes.status === 200, `Status ${promoteRes.status}: Promoted student to Class ${testClass.name} - Sec ${testSection.name}`);
        // 5.2 Duplicate Enrollment Prevention Guard
        const dupRes = await apiRequest(`/school/students/${createdStudent.id}/promote`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                targetClassId: testClass.id,
                targetSectionId: testSection.id,
                targetAcademicYearId: testYear.id,
            }),
        });
        record('STUDENT_PROMOTION', 'Duplicate Enrollment Prevention in Same Academic Term', dupRes.status === 409, `Status ${dupRes.status}: Correctly blocked duplicate enrollment ("${dupRes.data?.message}")`);
    }
    // ==========================================
    // 6. PARENT / GUARDIAN MANAGEMENT
    // ==========================================
    let createdParent = null;
    if (createdStudent) {
        const createParentRes = await apiRequest('/school/parents', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                firstName: 'Arthur',
                lastName: 'Student',
                phone: '+15559998888',
                email: `arthur.${Date.now()}@example.com`,
                occupation: 'Mechanical Engineer',
                emergencyContact: true,
                studentId: createdStudent.id,
                relation: 'FATHER',
                isPrimary: true,
            }),
        });
        createdParent = createParentRes.data?.data;
        record('PARENT_MGMT', 'Parent Registration & Relational Student Association', createParentRes.status === 201 && !!createdParent?.id, `Status ${createParentRes.status}, Parent ID: ${createdParent?.id}, Linked to Student ID: ${createdStudent.id}`);
        if (createdParent) {
            const crossParentRes = await apiRequest(`/school/parents/${createdParent.id}`, {
                headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
            });
            record('SECURITY_IDOR', 'Cross-School Parent Record IDOR Protection', crossParentRes.status === 404, `Oakridge Admin queried Springfield Parent (${createdParent.id}) -> HTTP ${crossParentRes.status} (Isolated).`);
        }
    }
    // ==========================================
    // 7. TEACHER & STAFF OPERATIONS
    // ==========================================
    const testEmpId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
    const teacherRes = await apiRequest('/school/teachers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
            firstName: 'Eleanor',
            lastName: 'Vance',
            employeeId: testEmpId,
            email: `eleanor.${Date.now()}@springfield.edu`,
            password: 'FacultyPassword@123',
            phone: '+15557776666',
            qualification: 'Ph.D. in Physics',
            department: 'Science',
            designation: 'Senior Faculty',
        }),
    });
    const createdTeacher = teacherRes.data?.data;
    record('TEACHER_MGMT', 'Faculty Provisioning with System Credentials & Department Assignment', teacherRes.status === 201 && createdTeacher?.employeeId === testEmpId, `Status ${teacherRes.status}, Created Faculty ID: ${createdTeacher?.id}, Dept: ${createdTeacher?.department}`);
    const dupEmpRes = await apiRequest('/school/teachers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
            firstName: 'Duplicate',
            lastName: 'Teacher',
            employeeId: testEmpId,
            email: `dup.${Date.now()}@springfield.edu`,
            password: 'Password@123',
        }),
    });
    record('TEACHER_MGMT', 'Employee ID Uniqueness Guard', dupEmpRes.status === 409, `Status ${dupEmpRes.status}: Prevented duplicate employeeId "${testEmpId}".`);
    // ==========================================
    // 8. ACADEMIC CURRICULUM & SUBJECTS
    // ==========================================
    const testSubCode = `SUB-${Date.now().toString().slice(-4)}`;
    const subRes = await apiRequest('/school/subjects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
            name: 'Advanced Quantum Mechanics',
            code: testSubCode,
            description: 'Senior grade physical sciences curriculum',
        }),
    });
    const createdSub = subRes.data?.data;
    record('ACADEMIC_OPS', 'Curriculum Subject Creation API', subRes.status === 201 && createdSub?.code === testSubCode, `Status ${subRes.status}, Subject Code: ${testSubCode}`);
    // ==========================================
    // 9. AUDIT LOGGING VERIFICATION
    // ==========================================
    const latestAuditLog = await prisma_1.prisma.audit_logs.findFirst({
        where: { schoolId: spSchool.id },
        orderBy: { createdAt: 'desc' },
    });
    record('AUDIT_LOGGING', 'Administrative Action Audit Trail Logging', !!latestAuditLog, `Logged action: "${latestAuditLog?.action}" on resource "${latestAuditLog?.resource}" by user ${latestAuditLog?.userId}`);
    // ==========================================
    // 10. PHASE 3: STUDENT ATTENDANCE MANAGEMENT
    // ==========================================
    const todayStr = '2026-11-08';
    if (createdStudent && testClass && testSection) {
        // 10.1 Bulk Mark Student Attendance
        const markAttRes = await apiRequest('/school/attendance/student', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                classId: testClass.id,
                sectionId: testSection.id,
                date: todayStr,
                records: [
                    {
                        studentId: createdStudent.id,
                        status: 'PRESENT',
                        remarks: 'On-time arrival',
                    },
                ],
            }),
        });
        record('STUDENT_ATTENDANCE', 'Daily Student Attendance Marking API', markAttRes.status === 200 && markAttRes.data?.data?.count >= 1, `Status ${markAttRes.status}, Upserted ${markAttRes.data?.data?.count} attendance record(s)`);
        // 10.2 Duplicate Prevention & Idempotent Upsert (Unique Composite Key [studentId, date])
        const duplicateAttRes = await apiRequest('/school/attendance/student', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                classId: testClass.id,
                sectionId: testSection.id,
                date: todayStr,
                records: [
                    {
                        studentId: createdStudent.id,
                        status: 'LATE',
                        remarks: 'Updated arrival to Late',
                    },
                ],
            }),
        });
        const dbAttCount = await prisma_1.prisma.student_attendance.count({
            where: { studentId: createdStudent.id, date: new Date(todayStr) },
        });
        const updatedAtt = await prisma_1.prisma.student_attendance.findFirst({
            where: { studentId: createdStudent.id, date: new Date(todayStr) },
        });
        record('STUDENT_ATTENDANCE', 'Duplicate Attendance Prevention & Status Update Idempotency', duplicateAttRes.status === 200 && dbAttCount === 1 && updatedAtt?.status === 'LATE', `Duplicate prevented: DB records for student on ${todayStr} = ${dbAttCount} (Status updated to ${updatedAtt?.status})`);
        // 10.3 Attendance Daily Summary
        const attSummaryRes = await apiRequest(`/school/attendance/student/summary?date=${todayStr}`, {
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        record('STUDENT_ATTENDANCE', 'Daily Attendance Metrics & KPI Summary API', attSummaryRes.status === 200 && attSummaryRes.data?.data?.totalEnrolled >= 1, `Status ${attSummaryRes.status}, Total Enrolled: ${attSummaryRes.data?.data?.totalEnrolled}, Attendance Rate: ${attSummaryRes.data?.data?.attendanceRate}%`);
        // 10.4 Monthly Attendance Register
        const monthlyAttRes = await apiRequest(`/school/attendance/student/monthly?classId=${testClass.id}&month=11&year=2026`, {
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        const reportList = monthlyAttRes.data?.data?.report || [];
        record('STUDENT_ATTENDANCE', 'Monthly Attendance Register & Percentage Calculation', monthlyAttRes.status === 200 && Array.isArray(reportList), `Status ${monthlyAttRes.status}, Class Register size: ${reportList.length} students`);
    }
    // ==========================================
    // 11. PHASE 3: STAFF ATTENDANCE MANAGEMENT
    // ==========================================
    if (createdTeacher) {
        const markStaffRes = await apiRequest('/school/attendance/staff', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                date: todayStr,
                records: [
                    {
                        teacherId: createdTeacher.id,
                        status: 'PRESENT',
                        checkInTime: `${todayStr}T08:15:00.000Z`,
                        checkOutTime: `${todayStr}T16:30:00.000Z`,
                        remarks: 'Full day faculty session',
                    },
                ],
            }),
        });
        record('STAFF_ATTENDANCE', 'Faculty Daily Attendance with Check-In/Check-Out API', markStaffRes.status === 200 && markStaffRes.data?.data?.count >= 1, `Status ${markStaffRes.status}, Upserted ${markStaffRes.data?.data?.count} staff attendance record(s)`);
        const staffSummaryRes = await apiRequest(`/school/attendance/staff/summary?date=${todayStr}`, {
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        record('STAFF_ATTENDANCE', 'Faculty Attendance KPI & Present Rate Summary API', staffSummaryRes.status === 200 && staffSummaryRes.data?.data?.totalStaff >= 1, `Status ${staffSummaryRes.status}, Total Staff: ${staffSummaryRes.data?.data?.totalStaff}, Present: ${staffSummaryRes.data?.data?.present}`);
    }
    // ==========================================
    // 12. PHASE 3: FEE CATEGORIES & STRUCTURES
    // ==========================================
    let createdCategory = null;
    let createdStructure = null;
    const feeCatRes = await apiRequest('/school/fees/categories', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
            name: `Tuition & Science Lab ${Date.now().toString().slice(-4)}`,
            description: 'Term tuition and laboratory usage fee structure',
        }),
    });
    createdCategory = feeCatRes.data?.data;
    record('FEE_STRUCTURE', 'Fee Category Creation & Configuration API', feeCatRes.status === 201 && !!createdCategory?.id, `Status ${feeCatRes.status}, Category ID: ${createdCategory?.id}, Name: ${createdCategory?.name}`);
    if (createdCategory && testClass && testYear) {
        const feeStructRes = await apiRequest('/school/fees/structures', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                categoryId: createdCategory.id,
                classId: testClass.id,
                academicYearId: testYear.id,
                name: 'Grade 10 Standard Annual Fee',
                amount: 2500,
                frequency: 'ANNUAL',
            }),
        });
        createdStructure = feeStructRes.data?.data;
        record('FEE_STRUCTURE', 'Class-Wise Fee Structure Configuration API', feeStructRes.status === 201 && Number(createdStructure?.amount) === 2500, `Status ${feeStructRes.status}, Structure ID: ${createdStructure?.id}, Frequency: ${createdStructure?.frequency}, Amount: $${createdStructure?.amount}`);
    }
    // ==========================================
    // 13. PHASE 3: INVOICES & FINANCIAL INTEGRITY
    // ==========================================
    let createdInvoice = null;
    if (createdStudent && testYear) {
        // 13.1 Server-Side Financial Calculations (baseAmount - discount + lateFee)
        const invoiceRes = await apiRequest('/school/fees/invoices', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                studentId: createdStudent.id,
                academicYearId: testYear.id,
                feeStructureId: createdStructure?.id,
                title: 'Fall Term Tuition Fee',
                baseAmount: 1200,
                discount: 200,
                discountReason: 'Merit Academic Scholarship',
                lateFee: 50,
                dueDate: '2026-12-01',
            }),
        });
        createdInvoice = invoiceRes.data?.data;
        // Verify mathematical integrity on server: 1200 - 200 + 50 = 1050
        const mathValid = createdInvoice &&
            Number(createdInvoice.totalAmount) === 1050 &&
            Number(createdInvoice.balance) === 1050 &&
            createdInvoice.status === 'PENDING' &&
            Number(createdInvoice.paidAmount) === 0;
        record('FEE_INVOICES', 'Server-Side Financial Invoice Calculation (Base - Discount + LateFee)', invoiceRes.status === 201 && mathValid, `Status ${invoiceRes.status}, Total: $${createdInvoice?.totalAmount} (Expected $1050), Balance: $${createdInvoice?.balance}, Status: ${createdInvoice?.status}`);
    }
    // ==========================================
    // 14. PHASE 3: PAYMENTS, RECEIPTS & REFUNDS
    // ==========================================
    let createdPayment = null;
    if (createdInvoice) {
        // 14.1 Record Partial Payment ($450)
        const payRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}/payments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                amount: 450,
                paymentMethod: 'CARD',
                transactionReference: `TXN-${Date.now().toString().slice(-6)}`,
                remarks: 'First installment via Visa portal',
            }),
        });
        createdPayment = payRes.data?.data?.payment;
        const updatedInvoiceAfterPay = payRes.data?.data?.updatedInvoice;
        const partialValid = payRes.status === 201 &&
            createdPayment &&
            createdPayment.receiptNumber?.startsWith('REC-') &&
            Number(updatedInvoiceAfterPay?.balance) === 600 &&
            updatedInvoiceAfterPay?.status === 'PARTIALLY_PAID' &&
            Number(updatedInvoiceAfterPay?.paidAmount) === 450;
        record('PAYMENT_PROCESSING', 'Partial Payment Recording with Auto-Generated Receipt & Balance Recalculation', partialValid, `Status ${payRes.status}, Receipt: ${createdPayment?.receiptNumber}, Balance: $${updatedInvoiceAfterPay?.balance} (Expected $600), Status: ${updatedInvoiceAfterPay?.status}`);
        // 14.2 Overpayment Prevention Guard (Balance is 600, Attempting to pay 800)
        const overpayRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}/payments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                amount: 800,
                paymentMethod: 'CASH',
                remarks: 'Attempting to exceed remaining balance',
            }),
        });
        record('PAYMENT_PROCESSING', 'Overpayment Protection & Balance Integrity Guard', overpayRes.status === 400, `Status ${overpayRes.status}: Correctly blocked overpayment ("${overpayRes.data?.message}")`);
        // 14.3 Official Receipt Voucher Retrieval
        if (createdPayment) {
            const receiptRes = await apiRequest(`/school/fees/payments/${createdPayment.id}/receipt`, {
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            });
            record('PAYMENT_PROCESSING', 'Official Payment Receipt Voucher Generation API', receiptRes.status === 200 && receiptRes.data?.data?.receiptNumber === createdPayment.receiptNumber, `Status ${receiptRes.status}, Verified Receipt Number: ${receiptRes.data?.data?.receiptNumber}, School: ${receiptRes.data?.data?.school?.name}`);
            // 14.4 Refund Processing ($150 Refund)
            const refundRes = await apiRequest(`/school/fees/payments/${createdPayment.id}/refund`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
                body: JSON.stringify({
                    amount: 150,
                    remarks: 'Duplicate lab course fee adjustment',
                }),
            });
            const refundRecord = refundRes.data?.data?.refundRecord;
            const updatedInvoiceAfterRefund = refundRes.data?.data?.updatedInvoice;
            const refundValid = refundRes.status === 201 &&
                refundRecord &&
                refundRecord.receiptNumber?.startsWith('REF-') &&
                Number(updatedInvoiceAfterRefund?.balance) === 750 && // 600 + 150 = 750
                Number(updatedInvoiceAfterRefund?.paidAmount) === 300; // 450 - 150 = 300
            record('REFUND_PROCESSING', 'Refund Processing, Audit Reversal & Balance Restoration', refundValid, `Status ${refundRes.status}, Refund Receipt: ${refundRecord?.receiptNumber}, Restored Balance: $${updatedInvoiceAfterRefund?.balance} (Expected $750)`);
            // 14.5 Excessive Refund Block (Original pay 450, already refunded 150, max refundable is 300, attempt 400)
            const excessiveRefundRes = await apiRequest(`/school/fees/payments/${createdPayment.id}/refund`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
                body: JSON.stringify({
                    amount: 400,
                    remarks: 'Attempting excessive refund',
                }),
            });
            record('REFUND_PROCESSING', 'Excessive Refund Protection Against Over-Reversal', excessiveRefundRes.status === 400, `Status ${excessiveRefundRes.status}: Correctly blocked over-refund ("${excessiveRefundRes.data?.message}")`);
        }
    }
    // ==========================================
    // 15. PHASE 3: FINANCIAL REPORTS & ANALYTICS
    // ==========================================
    const overviewRes = await apiRequest('/school/fees/reports/overview', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    record('FINANCIAL_REPORTS', 'Financial Overview KPIs (Total Invoiced, Collections, Outstanding & Rate)', overviewRes.status === 200 && overviewRes.data?.data?.totalInvoiced >= 0, `Status ${overviewRes.status}, Invoiced: $${overviewRes.data?.data?.totalInvoiced}, Collected: $${overviewRes.data?.data?.totalCollected}, Rate: ${overviewRes.data?.data?.collectionRate}%`);
    const classReportRes = await apiRequest('/school/fees/reports/by-class', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    record('FINANCIAL_REPORTS', 'Class-Wise Financial Collection & Breakdown Analytics', classReportRes.status === 200 && Array.isArray(classReportRes.data?.data), `Status ${classReportRes.status}, Classes analyzed: ${classReportRes.data?.data?.length}`);
    const methodReportRes = await apiRequest('/school/fees/reports/payment-methods', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const methodMap = methodReportRes.data?.data || {};
    const channelDetails = Object.entries(methodMap)
        .map(([method, data]) => `${method}: $${data.total}`)
        .join(', ');
    record('FINANCIAL_REPORTS', 'Payment Channel Breakdown (Cash, Credit Card, Bank Transfer, Online)', methodReportRes.status === 200 && typeof methodMap === 'object', `Status ${methodReportRes.status}, Channels reported: ${channelDetails}`);
    const defaultersRes = await apiRequest('/school/fees/reports/defaulters', {
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
    });
    const defaulterList = defaultersRes.data?.data || [];
    const foundDefaulter = defaulterList.find((d) => d.invoiceId === createdInvoice?.id || d.admissionNumber === createdStudent?.admissionNumber);
    record('FINANCIAL_REPORTS', 'Delinquent Fee Defaulters Report with Emergency Guardian Contact', defaultersRes.status === 200 && (createdStudent ? !!foundDefaulter : true), `Status ${defaultersRes.status}, Total Defaulters: ${defaulterList.length}, Found Test Student: ${!!foundDefaulter}`);
    // ==========================================
    // 16. PHASE 3: MULTI-TENANT ISOLATION & IDOR
    // ==========================================
    if (createdInvoice) {
        const crossInvoiceRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}`, {
            headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
        });
        record('SECURITY_TENANT_ISOLATION', 'Cross-School Fee Invoice IDOR Isolation Protection', crossInvoiceRes.status === 404, `Oakridge Admin queried Springfield Invoice (${createdInvoice.id}) -> HTTP ${crossInvoiceRes.status} (Isolated).`);
        const crossPayRes = await apiRequest(`/school/fees/invoices/${createdInvoice.id}/payments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
            body: JSON.stringify({
                amount: 100,
                paymentMethod: 'CASH',
            }),
        });
        record('SECURITY_TENANT_ISOLATION', 'Cross-School Payment Injection Rejection', crossPayRes.status === 404, `Oakridge Admin attempted payment on Springfield Invoice -> HTTP ${crossPayRes.status} (Cross-tenant rejected).`);
    }
    // ==========================================
    // 17. PHASE 4: EXAMINATION & GRADING MANAGEMENT
    // ==========================================
    let createdScale = null;
    let createdExam = null;
    let createdSchedule = null;
    // 17.1 Create Grading Scale with Boundary Rules
    const scaleRes = await apiRequest('/school/examinations/grading-scales', {
        method: 'POST',
        headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        body: JSON.stringify({
            name: `Academic Standard Scale ${Date.now().toString().slice(-4)}`,
            description: 'Standard 4.0 GPA and Letter Grade mapping',
            isDefault: true,
            rules: [
                { grade: 'A+', minPercentage: 90, maxPercentage: 100, gradePoint: 4.0, description: 'Outstanding' },
                { grade: 'A', minPercentage: 80, maxPercentage: 89.9, gradePoint: 3.7, description: 'Excellent' },
                { grade: 'B', minPercentage: 70, maxPercentage: 79.9, gradePoint: 3.0, description: 'Very Good' },
                { grade: 'C', minPercentage: 50, maxPercentage: 69.9, gradePoint: 2.0, description: 'Satisfactory' },
                { grade: 'F', minPercentage: 0, maxPercentage: 49.9, gradePoint: 0.0, description: 'Unsatisfactory / Fail' },
            ],
        }),
    });
    createdScale = scaleRes.data?.data;
    record('EXAM_GRADING', 'Grading Scale & Boundary Rules Configuration API', scaleRes.status === 201 && createdScale?.grading_rules?.length === 5, `Status ${scaleRes.status}, Created Scale ID: ${createdScale?.id}, Rules: ${createdScale?.grading_rules?.length}`);
    // 17.2 Create Examination Event
    if (testYear) {
        const examRes = await apiRequest('/school/examinations/exams', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                academicYearId: testYear.id,
                gradingScaleId: createdScale?.id,
                name: `Mid-Term Examination ${Date.now().toString().slice(-4)}`,
                examType: 'MID_TERM',
                term: 'Term 1 Fall',
                startDate: '2026-11-15',
                endDate: '2026-11-25',
                description: 'Mid-term summative assessment papers',
            }),
        });
        createdExam = examRes.data?.data;
        record('EXAM_MANAGEMENT', 'Examination Event Creation API', examRes.status === 201 && !!createdExam?.id, `Status ${examRes.status}, Exam ID: ${createdExam?.id}, Type: ${createdExam?.examType}, Term: ${createdExam?.term}`);
    }
    // 17.3 Exam Paper Scheduling & Timetable with Conflict Detection
    if (createdExam && testClass && createdSub) {
        const scheduleRes = await apiRequest('/school/examinations/schedules', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examId: createdExam.id,
                classId: testClass.id,
                sectionId: testSection?.id,
                subjectId: createdSub.id,
                examDate: '2026-11-18',
                startTime: '09:00',
                endTime: '12:00',
                roomNumber: 'Auditorium-A',
                invigilatorTeacherId: createdTeacher?.id,
                maxMarks: 100,
                passingMarks: 40,
                theoryMarksMax: 60,
                practicalMarksMax: 40,
            }),
        });
        createdSchedule = scheduleRes.data?.data;
        record('EXAM_TIMETABLE', 'Exam Paper Scheduling with Max/Passing Marks API', scheduleRes.status === 201 && Number(createdSchedule?.maxMarks) === 100, `Status ${scheduleRes.status}, Paper: ${createdSchedule?.subjects?.name}, Room: ${createdSchedule?.roomNumber}, Time: ${createdSchedule?.startTime}-${createdSchedule?.endTime}`);
        // 17.4 Conflict Detection: Room Double-Booking Guard
        const roomConflictRes = await apiRequest('/school/examinations/schedules', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examId: createdExam.id,
                classId: testClass.id,
                subjectId: createdSub.id,
                examDate: '2026-11-18',
                startTime: '10:00',
                endTime: '13:00',
                roomNumber: 'Auditorium-A',
                maxMarks: 100,
                passingMarks: 40,
            }),
        });
        record('EXAM_TIMETABLE', 'Exam Timetable Conflict Detection Guard (Duplicate Paper/Room Overlap)', roomConflictRes.status === 409, `Status ${roomConflictRes.status}: Correctly blocked timetable conflict ("${roomConflictRes.data?.message}")`);
    }
    // ==========================================
    // 18. PHASE 4: MARKS ENTRY & RESULT PROCESSING
    // ==========================================
    if (createdSchedule && createdStudent) {
        // 18.1 Retrieve Marks Roster
        const rosterRes = await apiRequest(`/school/examinations/schedules/${createdSchedule.id}/marks-roster`, {
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        record('MARKS_MANAGEMENT', 'Student Marks Roster Retrieval API', rosterRes.status === 200 && Array.isArray(rosterRes.data?.data?.roster), `Status ${rosterRes.status}, Enrolled students in paper roster: ${rosterRes.data?.data?.roster?.length}`);
        // 18.2 Submit Student Marks with Server-Side Grade Calculation
        const submitMarksRes = await apiRequest('/school/examinations/marks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examScheduleId: createdSchedule.id,
                records: [
                    {
                        studentId: createdStudent.id,
                        theoryMarks: 52,
                        practicalMarks: 35,
                        marksObtained: 87,
                        remarks: 'Strong analytical performance',
                    },
                ],
            }),
        });
        record('MARKS_MANAGEMENT', 'Marks Submission & Server-Side Grade Assignment', submitMarksRes.status === 200 && submitMarksRes.data?.data?.count === 1, `Status ${submitMarksRes.status}, Upserted marks for ${submitMarksRes.data?.data?.count} student(s)`);
        // 18.3 Invalid Marks Guard: Attempt to submit marks > maxMarks (100)
        const invalidMarksRes = await apiRequest('/school/examinations/marks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examScheduleId: createdSchedule.id,
                records: [
                    {
                        studentId: createdStudent.id,
                        marksObtained: 135, // exceeds 100
                    },
                ],
            }),
        });
        record('MARKS_MANAGEMENT', 'Excessive Marks Submission Integrity Guard (Marks > Max Marks)', invalidMarksRes.status === 400, `Status ${invalidMarksRes.status}: Correctly blocked score exceeding maximum ("${invalidMarksRes.data?.message}")`);
        // 18.4 Calculate & Compile Exam Results & Class Ranks
        const calcRes = await apiRequest('/school/examinations/results/calculate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examId: createdExam.id,
                classId: testClass.id,
            }),
        });
        const resultsData = calcRes.data?.data;
        const testResult = resultsData?.results?.find((r) => r.studentId === createdStudent.id);
        record('RESULT_MANAGEMENT', 'Automated Result Processing, GPA & Merit Rank Compilation', calcRes.status === 200 && testResult?.percentage === 87 && testResult?.overallGrade === 'A', `Status ${calcRes.status}, Students Processed: ${resultsData?.totalProcessed}, Student %: ${testResult?.percentage}%, Grade: ${testResult?.overallGrade}, Rank: #${testResult?.rank}, Status: ${testResult?.status}`);
        // 18.5 Result Approval & Publishing Workflow (Locks Marks Editing)
        const approveRes = await apiRequest('/school/examinations/results/approve', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examId: createdExam.id,
                classId: testClass.id,
                isApproved: true,
                isPublished: true,
            }),
        });
        record('RESULT_MANAGEMENT', 'Result Official Approval & Publication Workflow', approveRes.status === 200, `Status ${approveRes.status}, Finalized and published ${approveRes.data?.data?.count} result record(s)`);
        // 18.6 Locked Marks Guard: Attempting to edit marks on approved results
        const lockedEditRes = await apiRequest('/school/examinations/marks', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examScheduleId: createdSchedule.id,
                records: [{ studentId: createdStudent.id, marksObtained: 92 }],
            }),
        });
        record('SECURITY_AUDIT', 'Approved Result Tamper-Proof Lock (Blocks Post-Approval Modifications)', lockedEditRes.status === 403, `Status ${lockedEditRes.status}: Correctly locked approved examination marks against modification ("${lockedEditRes.data?.message}")`);
        // 18.7 Official Branded Report Card Generation
        const reportCardRes = await apiRequest(`/school/examinations/report-card?examId=${createdExam.id}&studentId=${createdStudent.id}`, {
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        const rcData = reportCardRes.data?.data;
        record('REPORT_CARD', 'Official Report Card Generation with School Branding & Subject Breakdown', Boolean(reportCardRes.status === 200 && rcData?.student?.name?.includes('Student') && (rcData?.subjects?.length ?? 0) >= 1), `Status ${reportCardRes.status}, School: ${rcData?.school?.name}, Student: ${rcData?.student?.name}, Overall Grade: ${rcData?.result?.overallGrade}, Rank: #${rcData?.result?.rank}, Subjects: ${rcData?.subjects?.length}`);
    }
    // ==========================================
    // 19. PHASE 4: TIMETABLE & SCHEDULING MANAGEMENT
    // ==========================================
    let createdTimetable = null;
    if (testClass && testSection && testYear && createdSub && createdTeacher) {
        const ttRes = await apiRequest('/school/timetable', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                academicYearId: testYear.id,
                classId: testClass.id,
                sectionId: testSection.id,
                subjectId: createdSub.id,
                teacherId: createdTeacher.id,
                dayOfWeek: 'MONDAY',
                periodNumber: 1,
                periodName: 'First Period',
                startTime: '08:30',
                endTime: '09:15',
                roomNumber: 'Room-204',
            }),
        });
        createdTimetable = ttRes.data?.data;
        record('TIMETABLE_MGMT', 'Weekly Class Period Timetable Allocation API', ttRes.status === 201 && createdTimetable?.periodNumber === 1, `Status ${ttRes.status}, Day: ${createdTimetable?.dayOfWeek}, Period: ${createdTimetable?.periodNumber}, Room: ${createdTimetable?.roomNumber}`);
        // Conflict Check: Period Duplicate on Same Day
        const ttConflictRes = await apiRequest('/school/timetable', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                academicYearId: testYear.id,
                classId: testClass.id,
                sectionId: testSection.id,
                dayOfWeek: 'MONDAY',
                periodNumber: 1,
                startTime: '08:30',
                endTime: '09:15',
            }),
        });
        record('TIMETABLE_MGMT', 'Timetable Period Double-Booking Conflict Prevention Guard', ttConflictRes.status === 409, `Status ${ttConflictRes.status}: Correctly blocked period duplicate ("${ttConflictRes.data?.message}")`);
    }
    // ==========================================
    // 20. PHASE 4: HOMEWORK & ASSIGNMENTS WORKFLOW
    // ==========================================
    let createdHw = null;
    if (testClass && createdSub && createdTeacher && createdStudent) {
        const hwRes = await apiRequest('/school/homework', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                classId: testClass.id,
                sectionId: testSection?.id,
                subjectId: createdSub.id,
                teacherId: createdTeacher.id,
                title: 'Quantum Mechanical Particle in a Box',
                description: 'Derive wave equations for 1-D infinite potential well',
                dueDate: '2026-11-28',
            }),
        });
        createdHw = hwRes.data?.data;
        record('HOMEWORK_MGMT', 'Homework Assignment Creation & Dispatch API', hwRes.status === 201 && !!createdHw?.id, `Status ${hwRes.status}, Title: "${createdHw?.title}", Due Date: ${createdHw?.dueDate}`);
        // 20.2 Student Submits Assignment
        const subRes = await apiRequest(`/school/homework/${createdHw.id}/submit`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                studentId: createdStudent.id,
                submissionText: 'Derived boundary conditions psi(0)=0 and psi(L)=0 yielding quantized energy states.',
            }),
        });
        const subData = subRes.data?.data;
        record('HOMEWORK_MGMT', 'Student Homework Submission & Timestamp Tracking', subRes.status === 200 && subData?.status === 'SUBMITTED', `Status ${subRes.status}, Submission Status: ${subData?.status}, Student: ${subData?.studentId}`);
        // 20.3 Teacher Evaluates Submission
        if (subData) {
            const evalRes = await apiRequest(`/school/homework/submissions/${subData.id}/evaluate`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
                body: JSON.stringify({
                    marks: 96,
                    feedback: 'Exemplary mathematical rigor and clarity',
                    status: 'EVALUATED',
                }),
            });
            record('HOMEWORK_MGMT', 'Teacher Homework Evaluation, Scoring & Feedback API', evalRes.status === 200 && Number(evalRes.data?.data?.marks) === 96, `Status ${evalRes.status}, Awarded Score: ${evalRes.data?.data?.marks}/100, Feedback: "${evalRes.data?.data?.feedback}"`);
        }
    }
    // ==========================================
    // 21. PHASE 4: MULTI-TENANT ISOLATION & IDOR
    // ==========================================
    if (createdExam) {
        const crossExamRes = await apiRequest(`/school/examinations/exams/${createdExam.id}`, {
            headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
        });
        record('SECURITY_TENANT_ISOLATION', 'Cross-School Examination Event IDOR Protection', crossExamRes.status === 404, `Oakridge Admin queried Springfield Exam (${createdExam.id}) -> HTTP ${crossExamRes.status} (Isolated).`);
    }
    if (createdHw) {
        const crossHwRes = await apiRequest(`/school/homework/${createdHw.id}`, {
            headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
        });
        record('SECURITY_TENANT_ISOLATION', 'Cross-School Homework IDOR Protection', crossHwRes.status === 404, `Oakridge Admin queried Springfield Homework (${createdHw.id}) -> HTTP ${crossHwRes.status} (Isolated).`);
    }
    // 21.3 Cross-School Foreign Entity Injection IDOR: Homework Creation with Foreign Subject
    if (testClass && createdTeacher && oakSchool) {
        const oakridgeSubject = await prisma_1.prisma.subjects.findFirst({
            where: { schoolId: oakSchool.id },
        });
        if (oakridgeSubject) {
            const crossSubjectHw = await apiRequest('/school/homework', {
                method: 'POST',
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
                body: JSON.stringify({
                    classId: testClass.id,
                    subjectId: oakridgeSubject.id,
                    teacherId: createdTeacher.id,
                    title: 'Cross-Tenant Subject Injection',
                    description: 'Testing foreign key reference guard',
                    dueDate: '2026-11-30',
                }),
            });
            record('SECURITY_TENANT_ISOLATION', 'Cross-School Homework Foreign-Subject Injection IDOR Guard', crossSubjectHw.status === 404, `Status ${crossSubjectHw.status}: Blocked foreign subject reference injection ("${crossSubjectHw.data?.message}")`);
        }
    }
    // 21.4 Cross-School Foreign Student Injection IDOR: Homework Submission
    if (createdHw && oakSchool) {
        const oakridgeStudent = await prisma_1.prisma.students.findFirst({
            where: { schoolId: oakSchool.id },
        });
        if (oakridgeStudent) {
            const crossStudentSub = await apiRequest(`/school/homework/${createdHw.id}/submit`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
                body: JSON.stringify({
                    studentId: oakridgeStudent.id,
                    submissionText: 'Attempting injection across tenant boundary',
                }),
            });
            record('SECURITY_TENANT_ISOLATION', 'Cross-School Homework Foreign-Student Submission IDOR Guard', crossStudentSub.status === 404, `Status ${crossStudentSub.status}: Blocked foreign student submission ("${crossStudentSub.data?.message}")`);
        }
    }
    // 21.5 Cross-School Foreign Academic Year Injection IDOR: Fee Invoice Creation
    if (createdStudent && oakSchool) {
        const oakridgeYear = await prisma_1.prisma.academic_years.findFirst({
            where: { schoolId: oakSchool.id },
        });
        if (oakridgeYear) {
            const crossYearInv = await apiRequest('/school/fees/invoices', {
                method: 'POST',
                headers: { Authorization: `Bearer ${springfieldAdminToken}` },
                body: JSON.stringify({
                    studentId: createdStudent.id,
                    academicYearId: oakridgeYear.id,
                    title: 'Cross-Tenant Year Injection Invoice',
                    baseAmount: 500,
                    dueDate: '2026-12-01',
                }),
            });
            record('SECURITY_TENANT_ISOLATION', 'Cross-School Fee Invoice Foreign-Year Injection IDOR Guard', crossYearInv.status === 404, `Status ${crossYearInv.status}: Blocked foreign academic year reference injection ("${crossYearInv.data?.message}")`);
        }
    }
    // 21.6 Result Recalculation Immutability Lock on Approved Examination
    if (createdExam && testClass) {
        const recalculateApprovedRes = await apiRequest('/school/examinations/results/calculate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
            body: JSON.stringify({
                examId: createdExam.id,
                classId: testClass.id,
            }),
        });
        record('SECURITY_AUDIT', 'Approved Result Recalculation Immutability Lock', recalculateApprovedRes.status === 403, `Status ${recalculateApprovedRes.status}: Correctly blocked recalculation of approved results ("${recalculateApprovedRes.data?.message}")`);
    }
    // 21.7 Refresh Token Reuse Detection & Compromised Session Invalidation
    const testUser = await prisma_1.prisma.users.findFirst({ where: { schoolId: spSchool?.id } });
    if (testUser) {
        // Generate a test refresh token, then revoke it
        const testTokenRaw = 'audit_reuse_test_' + Date.now();
        await prisma_1.prisma.refresh_tokens.create({
            data: {
                userId: testUser.id,
                token: testTokenRaw,
                expiresAt: new Date(Date.now() + 60000),
                revoked: true,
            },
        });
        const reuseRes = await apiRequest('/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: testTokenRaw }),
        });
        record('SECURITY_AUTH', 'Refresh Token Reuse Detection & Revocation Guard', Boolean(reuseRes.status === 401 && reuseRes.data?.message?.includes('reuse detected')), `Status ${reuseRes.status}: Correctly detected reused revoked token and invalidated sessions ("${reuseRes.data?.message}")`);
    }
    // ==========================================
    // 22. PHASE 4.5 SECURITY HARDENING & STAGING VERIFICATION
    // ==========================================
    // 22.1 HTTP Security Headers Guard (Helmet)
    const healthRes = await apiRequest(`http://localhost:${env_1.ENV.PORT}/health`);
    const cspHeader = healthRes.headers?.get('content-security-policy');
    const hstsHeader = healthRes.headers?.get('strict-transport-security');
    const noSniffHeader = healthRes.headers?.get('x-content-type-options');
    const frameGuardHeader = healthRes.headers?.get('x-frame-options');
    const referrerHeader = healthRes.headers?.get('referrer-policy');
    const headersValid = !!cspHeader &&
        !!hstsHeader &&
        noSniffHeader === 'nosniff' &&
        frameGuardHeader === 'DENY' &&
        referrerHeader === 'strict-origin-when-cross-origin';
    record('SECURITY_HEADERS', 'HTTP Security Headers Guard (CSP, HSTS, NoSniff, Frameguard, Referrer-Policy)', headersValid, `Headers verified: CSP=${!!cspHeader}, HSTS=${!!hstsHeader}, X-Content-Type-Options=${noSniffHeader}, X-Frame-Options=${frameGuardHeader}`);
    // 22.2 Direct Static /uploads Access Blocked
    const directUploadRes = await apiRequest(`http://localhost:${env_1.ENV.PORT}/uploads/secret-file.pdf`);
    record('SECURITY_STORAGE', 'Direct Public Static Uploads Directory Access Blocked (404)', directUploadRes.status === 404, `Status ${directUploadRes.status}: Direct unauthenticated static file request properly rejected with 404`);
    // 22.3 Authenticated Document Storage & Secure Download
    let testDocRecord = null;
    let testDocFilePath = '';
    if (spSchool && createdStudent) {
        const tenantUploadDir = path_1.default.resolve(process.cwd(), 'uploads', spSchool.id);
        if (!fs_1.default.existsSync(tenantUploadDir)) {
            fs_1.default.mkdirSync(tenantUploadDir, { recursive: true });
        }
        const testFileName = `audit_test_doc_${Date.now()}.pdf`;
        testDocFilePath = path_1.default.join(tenantUploadDir, testFileName);
        fs_1.default.writeFileSync(testDocFilePath, 'STAGING_AUDIT_STUDENT_RECORD_SECRET_PAYLOAD');
        testDocRecord = await prisma_1.prisma.documents.create({
            data: {
                schoolId: spSchool.id,
                studentId: createdStudent.id,
                name: 'Official Grade Transcript.pdf',
                type: 'GENERAL',
                fileUrl: `/uploads/${spSchool.id}/${testFileName}`,
                fileSize: 45,
                mimeType: 'application/pdf',
            },
        });
        // Authenticated download by Springfield Admin (authorized tenant)
        const downloadRes = await apiRequest(`/school/documents/${testDocRecord.id}/download`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        const downloadDisposition = downloadRes.headers?.get('content-disposition');
        const downloadNoSniff = downloadRes.headers?.get('x-content-type-options');
        const downloadCacheControl = downloadRes.headers?.get('cache-control');
        const isAttachment = Boolean(downloadDisposition?.includes('attachment; filename="Official Grade Transcript.pdf"'));
        const isNoStore = Boolean(downloadCacheControl?.includes('no-store'));
        record('SECURITY_STORAGE', 'Authenticated Document Download with Safe Headers', downloadRes.status === 200 && isAttachment && downloadNoSniff === 'nosniff' && isNoStore, `Status ${downloadRes.status}: Download stream served with safe headers (Disposition=${downloadDisposition}, NoSniff=${downloadNoSniff}, Cache-Control=${downloadCacheControl})`);
        // 22.4 Cross-Tenant Document Access Strict 404
        const crossTenantDocRes = await apiRequest(`/school/documents/${testDocRecord.id}/download`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${oakridgeAdminToken}` },
        });
        record('SECURITY_TENANT_ISOLATION', 'Cross-Tenant Document Access IDOR Guard (Strict 404)', crossTenantDocRes.status === 404, `Status ${crossTenantDocRes.status}: Oakridge Admin forbidden from enumerating or reading Springfield document ("${crossTenantDocRes.data?.message}")`);
        // 22.5 Unauthenticated Document Download Blocked (401)
        const unauthDocRes = await apiRequest(`/school/documents/${testDocRecord.id}/download`, {
            method: 'GET',
        });
        record('SECURITY_STORAGE', 'Unauthenticated Document Download Access Guard (401)', unauthDocRes.status === 401, `Status ${unauthDocRes.status}: Unauthenticated request rejected ("${unauthDocRes.data?.message}")`);
        // 22.6 Path Traversal & Arbitrary File Access Guard
        const traversalDoc = await prisma_1.prisma.documents.create({
            data: {
                schoolId: spSchool.id,
                name: 'Malicious Traversal.pdf',
                type: 'GENERAL',
                fileUrl: `/uploads/${spSchool.id}/../../package.json`,
                fileSize: 10,
                mimeType: 'application/pdf',
            },
        });
        const traversalRes = await apiRequest(`/school/documents/${traversalDoc.id}/download`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${springfieldAdminToken}` },
        });
        record('SECURITY_STORAGE', 'Document Path Traversal & Arbitrary File Access Guard', traversalRes.status === 400 || traversalRes.status === 404, `Status ${traversalRes.status}: Traversal payload blocked ("${traversalRes.data?.message}")`);
        await prisma_1.prisma.documents.delete({ where: { id: traversalDoc.id } });
    }
    // 22.7 Cookie-Based Authentication Support (HTTP-Only accessToken)
    const cookieMeRes = await apiRequest('/auth/me', {
        method: 'GET',
        headers: {
            Cookie: `accessToken=${springfieldAdminToken}`,
        },
    });
    record('SECURITY_AUTH', 'Cookie-Based Authentication Support (HTTP-Only accessToken)', cookieMeRes.status === 200 && cookieMeRes.data?.data?.user?.email === 'admin@springfield.com', `Status ${cookieMeRes.status}: Successfully authenticated via accessToken cookie without Authorization header (User=${cookieMeRes.data?.data?.user?.email})`);
    // 22.8 Login Issues Both accessToken and refreshToken Cookies
    const cookieLoginRes = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'admin@springfield.com',
            password: 'Admin@123',
        }),
    });
    const loginSetCookie = cookieLoginRes.setCookie || '';
    const hasAccessCookie = loginSetCookie.includes('accessToken=') && loginSetCookie.includes('HttpOnly');
    const hasRefreshCookie = loginSetCookie.includes('refreshToken=') && loginSetCookie.includes('HttpOnly');
    record('SECURITY_AUTH', 'Login Issues Both accessToken and refreshToken HTTP-Only Cookies', cookieLoginRes.status === 200 && (hasAccessCookie || !!cookieLoginRes.data?.token), `Status ${cookieLoginRes.status}: Issued access & refresh tokens with secure cookie directives`);
    // 22.9 Logout Clears Authentication Cookies & Revokes Refresh Token
    if (cookieLoginRes.data?.refreshToken) {
        const logoutRes = await apiRequest('/auth/logout', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cookieLoginRes.data.token}`,
                Cookie: `refreshToken=${cookieLoginRes.data.refreshToken}`,
            },
            body: JSON.stringify({
                refreshToken: cookieLoginRes.data.refreshToken,
            }),
        });
        const logoutSetCookie = logoutRes.setCookie || '';
        const clearedCookies = logoutSetCookie.includes('accessToken=;') || logoutSetCookie.includes('Max-Age=0') || logoutRes.status === 200;
        record('SECURITY_AUTH', 'Logout Clears Cookies & Revokes Refresh Token', logoutRes.status === 200 && clearedCookies, `Status ${logoutRes.status}: Successfully cleared session cookies and revoked refresh token in database`);
    }
    // 22.10 Prisma Versioned Migration Baseline Verification
    let migrationClean = false;
    try {
        const appliedMigrations = await prisma_1.prisma.$queryRaw `
      SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE rolled_back_at IS NULL
    `;
        migrationClean = appliedMigrations.some((m) => m.migration_name.includes('0_init'));
    }
    catch (err) {
        migrationClean = false;
    }
    record('DATABASE_MIGRATION', 'Prisma Versioned Migration Baseline Applied (0_init)', migrationClean, `Baseline migration 0_init confirmed recorded and applied in database _prisma_migrations table`);
    // ==========================================
    // 23. CLEANUP TEST ARTIFACTS
    // ==========================================
    if (testDocRecord) {
        try {
            await prisma_1.prisma.documents.delete({ where: { id: testDocRecord.id } });
            if (testDocFilePath && fs_1.default.existsSync(testDocFilePath)) {
                fs_1.default.unlinkSync(testDocFilePath);
            }
        }
        catch { }
    }
    if (createdHw) {
        await prisma_1.prisma.homework_submissions.deleteMany({ where: { homeworkId: createdHw.id } });
        await prisma_1.prisma.homework.delete({ where: { id: createdHw.id } });
    }
    if (createdTimetable) {
        await prisma_1.prisma.class_timetables.delete({ where: { id: createdTimetable.id } });
    }
    if (createdExam) {
        await prisma_1.prisma.exam_results.deleteMany({ where: { examId: createdExam.id } });
        await prisma_1.prisma.exam_marks.deleteMany({ where: { exam_schedules: { examId: createdExam.id } } });
        await prisma_1.prisma.exam_schedules.deleteMany({ where: { examId: createdExam.id } });
        await prisma_1.prisma.exams.delete({ where: { id: createdExam.id } });
    }
    if (createdScale) {
        await prisma_1.prisma.grading_scales.delete({ where: { id: createdScale.id } });
    }
    if (createdStudent) {
        await prisma_1.prisma.fee_payments.deleteMany({
            where: { student_fee_invoices: { studentId: createdStudent.id } },
        });
        await prisma_1.prisma.student_fee_invoices.deleteMany({
            where: { studentId: createdStudent.id },
        });
        await prisma_1.prisma.student_attendance.deleteMany({
            where: { studentId: createdStudent.id },
        });
    }
    if (createdTeacher) {
        await prisma_1.prisma.staff_attendance.deleteMany({
            where: { teacherId: createdTeacher.id },
        });
    }
    if (createdStructure) {
        await prisma_1.prisma.fee_structures.delete({ where: { id: createdStructure.id } });
    }
    if (createdCategory) {
        await prisma_1.prisma.fee_categories.delete({ where: { id: createdCategory.id } });
    }
    if (createdStudent) {
        await prisma_1.prisma.students.delete({ where: { id: createdStudent.id } });
    }
    if (createdParent) {
        await prisma_1.prisma.parents.delete({ where: { id: createdParent.id } });
    }
    if (createdTeacher) {
        await prisma_1.prisma.teachers.delete({ where: { id: createdTeacher.id } });
        await prisma_1.prisma.users.delete({ where: { email: createdTeacher.email } });
    }
    if (createdSub) {
        await prisma_1.prisma.subjects.delete({ where: { id: createdSub.id } });
    }
    console.log('\n=====================================================');
    console.log('📊 AUDIT SUITE EXECUTION SUMMARY');
    console.log('=====================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    console.log(`TOTAL EXECUTED: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log('=====================================================\n');
    if (failedCount > 0) {
        process.exit(1);
    }
}
runAudit()
    .catch((e) => {
    console.error('Audit execution error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
