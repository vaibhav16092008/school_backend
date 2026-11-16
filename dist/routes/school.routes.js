"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const school_controller_1 = require("../controllers/school.controller");
const student_controller_1 = require("../controllers/student.controller");
const parent_controller_1 = require("../controllers/parent.controller");
const teacher_controller_1 = require("../controllers/teacher.controller");
const academic_controller_1 = require("../controllers/academic.controller");
const document_controller_1 = require("../controllers/document.controller");
const attendance_controller_1 = require("../controllers/attendance.controller");
const fee_controller_1 = require("../controllers/fee.controller");
const examination_controller_1 = require("../controllers/examination.controller");
const timetable_controller_1 = require("../controllers/timetable.controller");
const homework_controller_1 = require("../controllers/homework.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const prisma_1 = require("../lib/prisma");
const validate_middleware_1 = require("../middleware/validate.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const school_validator_1 = require("../validators/school.validator");
const academic_validator_1 = require("../validators/academic.validator");
const attendance_validator_1 = require("../validators/attendance.validator");
const fee_validator_1 = require("../validators/fee.validator");
const examination_validator_1 = require("../validators/examination.validator");
const timetable_validator_1 = require("../validators/timetable.validator");
const homework_validator_1 = require("../validators/homework.validator");
const router = (0, express_1.Router)();
// Protect all school routes: Must be authenticated, must be SCHOOL_ADMIN or SUPER_ADMIN, and must pass tenant isolation
router.use(auth_middleware_1.authenticateJwt, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), tenant_middleware_1.requireTenant);
// ==================== SCHOOL INFO & STATS ====================
router.get('/info', school_controller_1.getMySchool);
router.patch('/info', (0, validate_middleware_1.validateRequest)({ body: school_validator_1.updateSchoolProfileSchema }), school_controller_1.updateMySchool);
router.get('/stats', school_controller_1.getSchoolStats);
// ==================== STUDENTS ====================
router.get('/students', student_controller_1.getStudents);
router.post('/students', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createStudentSchema }), student_controller_1.createStudent);
router.get('/students/:id', student_controller_1.getStudentById);
router.patch('/students/:id', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.updateStudentSchema }), student_controller_1.updateStudent);
router.delete('/students/:id', student_controller_1.deleteStudent);
router.patch('/students/:id/archive', student_controller_1.archiveStudent);
router.post('/students/:id/promote', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.promoteStudentSchema }), student_controller_1.promoteStudent);
router.get('/students/:id/id-card', student_controller_1.getStudentIdCard);
// ==================== PARENTS / GUARDIANS ====================
router.get('/parents', parent_controller_1.getParents);
router.post('/parents', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createParentSchema }), parent_controller_1.createParent);
router.get('/parents/:id', parent_controller_1.getParentById);
router.patch('/parents/:id', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.updateParentSchema }), parent_controller_1.updateParent);
router.delete('/parents/:id', parent_controller_1.deleteParent);
router.post('/parents/:id/students', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.linkParentStudentSchema }), parent_controller_1.linkStudentToParent);
router.delete('/parents/:id/students/:studentId', parent_controller_1.unlinkStudentFromParent);
// ==================== TEACHERS & STAFF ====================
router.get('/teachers', teacher_controller_1.getTeachers);
router.post('/teachers', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createTeacherSchema }), teacher_controller_1.createTeacher);
router.get('/teachers/:id', teacher_controller_1.getTeacherById);
router.patch('/teachers/:id', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.updateTeacherSchema }), teacher_controller_1.updateTeacher);
router.delete('/teachers/:id', teacher_controller_1.deleteTeacher);
// ==================== CLASSES & SECTIONS ====================
router.get('/classes', academic_controller_1.getClasses);
router.post('/classes', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createClassSchema }), academic_controller_1.createClass);
router.patch('/classes/:id', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.updateClassSchema }), academic_controller_1.updateClass);
router.delete('/classes/:id', academic_controller_1.deleteClass);
router.post('/classes/:classId/sections', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createSectionSchema }), academic_controller_1.createSection);
router.patch('/sections/:id', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.updateSectionSchema }), academic_controller_1.updateSection);
router.delete('/sections/:id', academic_controller_1.deleteSection);
router.post('/classes/:classId/subjects', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.assignSubjectSchema }), academic_controller_1.assignSubjectToClass);
// ==================== ACADEMIC YEARS & SUBJECTS ====================
router.get('/academic-years', academic_controller_1.getAcademicYears);
router.post('/academic-years', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createAcademicYearSchema }), academic_controller_1.createAcademicYear);
router.patch('/academic-years/:id/current', academic_controller_1.setCurrentAcademicYear);
router.get('/subjects', academic_controller_1.getSubjects);
router.post('/subjects', (0, validate_middleware_1.validateRequest)({ body: academic_validator_1.createSubjectSchema }), academic_controller_1.createSubject);
// ==================== DOCUMENTS & FILE UPLOADS ====================
router.post('/documents/upload', upload_middleware_1.upload.single('file'), document_controller_1.uploadDocument);
router.get('/documents', document_controller_1.getDocuments);
router.get('/documents/:id/download', document_controller_1.downloadDocument);
router.delete('/documents/:id', document_controller_1.deleteDocument);
// ==================== STUDENT ATTENDANCE (PHASE 3) ====================
router.post('/attendance/student', (0, validate_middleware_1.validateRequest)({ body: attendance_validator_1.markStudentAttendanceSchema }), attendance_controller_1.markStudentAttendance);
router.get('/attendance/student', attendance_controller_1.getStudentAttendance);
router.get('/attendance/student/summary', attendance_controller_1.getStudentAttendanceSummary);
router.get('/attendance/student/monthly', attendance_controller_1.getStudentMonthlyReport);
// ==================== STAFF ATTENDANCE (PHASE 3) ====================
router.post('/attendance/staff', (0, validate_middleware_1.validateRequest)({ body: attendance_validator_1.markStaffAttendanceSchema }), attendance_controller_1.markStaffAttendance);
router.get('/attendance/staff', attendance_controller_1.getStaffAttendance);
router.get('/attendance/staff/summary', attendance_controller_1.getStaffAttendanceSummary);
// ==================== FEE MANAGEMENT (PHASE 3) ====================
router.get('/fees/categories', fee_controller_1.getFeeCategories);
router.post('/fees/categories', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.createFeeCategorySchema }), fee_controller_1.createFeeCategory);
router.patch('/fees/categories/:id', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.updateFeeCategorySchema }), fee_controller_1.updateFeeCategory);
router.delete('/fees/categories/:id', fee_controller_1.deleteFeeCategory);
router.get('/fees/structures', fee_controller_1.getFeeStructures);
router.post('/fees/structures', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.createFeeStructureSchema }), fee_controller_1.createFeeStructure);
router.patch('/fees/structures/:id', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.updateFeeStructureSchema }), fee_controller_1.updateFeeStructure);
router.delete('/fees/structures/:id', fee_controller_1.deleteFeeStructure);
router.get('/fees/invoices', fee_controller_1.getInvoices);
router.post('/fees/invoices', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.createInvoiceSchema }), fee_controller_1.createInvoice);
router.post('/fees/invoices/generate-bulk', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.generateBulkInvoicesSchema }), fee_controller_1.generateBulkInvoices);
router.get('/fees/invoices/:id', fee_controller_1.getInvoiceById);
router.post('/fees/invoices/:id/payments', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.recordPaymentSchema }), fee_controller_1.recordPayment);
router.get('/fees/payments/:id/receipt', fee_controller_1.getPaymentReceipt);
router.post('/fees/payments/:id/refund', (0, validate_middleware_1.validateRequest)({ body: fee_validator_1.recordRefundSchema }), fee_controller_1.recordRefund);
// ==================== FINANCIAL REPORTS (PHASE 3) ====================
router.get('/fees/reports/overview', fee_controller_1.getFinancialOverview);
router.get('/fees/reports/by-class', fee_controller_1.getClassWiseCollectionReport);
router.get('/fees/reports/payment-methods', fee_controller_1.getPaymentMethodBreakdown);
router.get('/fees/reports/defaulters', fee_controller_1.getPendingFeeDefaulters);
// ==================== EXAMINATION & GRADING (PHASE 4) ====================
router.get('/examinations/grading-scales', examination_controller_1.getGradingScales);
router.post('/examinations/grading-scales', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.createGradingScaleSchema }), examination_controller_1.createGradingScale);
router.delete('/examinations/grading-scales/:id', examination_controller_1.deleteGradingScale);
router.get('/examinations/exams', examination_controller_1.getExams);
router.post('/examinations/exams', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.createExamSchema }), examination_controller_1.createExam);
router.get('/examinations/exams/:id', examination_controller_1.getExamById);
router.patch('/examinations/exams/:id', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.updateExamSchema }), examination_controller_1.updateExam);
router.delete('/examinations/exams/:id', examination_controller_1.deleteExam);
router.get('/examinations/schedules', examination_controller_1.getExamSchedules);
router.post('/examinations/schedules', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.createExamScheduleSchema }), examination_controller_1.createExamSchedule);
router.delete('/examinations/schedules/:id', examination_controller_1.deleteExamSchedule);
router.get('/examinations/schedules/:scheduleId/marks-roster', examination_controller_1.getExamMarksRoster);
router.post('/examinations/marks', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.submitMarksSchema }), examination_controller_1.submitExamMarks);
router.post('/examinations/results/calculate', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.calculateResultsSchema }), examination_controller_1.calculateExamResults);
router.get('/examinations/results', examination_controller_1.getExamResults);
router.post('/examinations/results/approve', (0, validate_middleware_1.validateRequest)({ body: examination_validator_1.approveResultsSchema }), examination_controller_1.approveExamResults);
router.get('/examinations/report-card', examination_controller_1.getStudentReportCard);
// ==================== TIMETABLE MANAGEMENT (PHASE 4) ====================
router.get('/timetable', timetable_controller_1.getTimetable);
router.post('/timetable', (0, validate_middleware_1.validateRequest)({ body: timetable_validator_1.createTimetableEntrySchema }), timetable_controller_1.createTimetableEntry);
router.delete('/timetable/:id', timetable_controller_1.deleteTimetableEntry);
// ==================== HOMEWORK & ASSIGNMENTS (PHASE 4) ====================
router.get('/homework', homework_controller_1.getHomework);
router.post('/homework', (0, validate_middleware_1.validateRequest)({ body: homework_validator_1.createHomeworkSchema }), homework_controller_1.createHomework);
router.get('/homework/:id', homework_controller_1.getHomeworkById);
router.post('/homework/:id/submit', (0, validate_middleware_1.validateRequest)({ body: homework_validator_1.submitHomeworkSchema }), homework_controller_1.submitHomework);
router.post('/homework/submissions/:submissionId/evaluate', (0, validate_middleware_1.validateRequest)({ body: homework_validator_1.evaluateHomeworkSchema }), homework_controller_1.evaluateHomework);
router.delete('/homework/:id', homework_controller_1.deleteHomework);
exports.default = router;
