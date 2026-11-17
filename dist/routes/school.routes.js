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
const transport_controller_1 = require("../controllers/transport.controller");
const library_controller_1 = require("../controllers/library.controller");
const inventory_controller_1 = require("../controllers/inventory.controller");
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
const transport_validator_1 = require("../validators/transport.validator");
const library_validator_1 = require("../validators/library.validator");
const inventory_validator_1 = require("../validators/inventory.validator");
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
// ==================== TRANSPORT MANAGEMENT (PHASE 5.1) ====================
// Dashboard
router.get('/transport/dashboard', transport_controller_1.getTransportDashboard);
// Vehicles
router.get('/transport/vehicles', transport_controller_1.getVehicles);
router.post('/transport/vehicles', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.createVehicleSchema }), transport_controller_1.createVehicle);
router.get('/transport/vehicles/:id', transport_controller_1.getVehicleById);
router.patch('/transport/vehicles/:id', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.updateVehicleSchema }), transport_controller_1.updateVehicle);
router.delete('/transport/vehicles/:id', transport_controller_1.deleteVehicle);
// Routes
router.get('/transport/routes', transport_controller_1.getRoutes);
router.post('/transport/routes', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.createRouteSchema }), transport_controller_1.createRoute);
router.get('/transport/routes/:id', transport_controller_1.getRouteById);
router.patch('/transport/routes/:id', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.updateRouteSchema }), transport_controller_1.updateRoute);
router.delete('/transport/routes/:id', transport_controller_1.deleteRoute);
// Route Stops
router.post('/transport/stops', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.createStopSchema }), transport_controller_1.createStop);
router.patch('/transport/stops/:id', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.updateStopSchema }), transport_controller_1.updateStop);
router.delete('/transport/stops/:id', transport_controller_1.deleteStop);
router.post('/transport/stops/reorder', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.reorderStopsSchema }), transport_controller_1.reorderStops);
// Drivers
router.get('/transport/drivers', transport_controller_1.getDrivers);
router.post('/transport/drivers', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.createDriverSchema }), transport_controller_1.createDriver);
router.get('/transport/drivers/:id', transport_controller_1.getDriverById);
router.patch('/transport/drivers/:id', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.updateDriverSchema }), transport_controller_1.updateDriver);
router.delete('/transport/drivers/:id', transport_controller_1.deleteDriver);
// Vehicle & Route Assignments
router.get('/transport/assignments', transport_controller_1.getAssignments);
router.post('/transport/assignments', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.createAssignmentSchema }), transport_controller_1.createAssignment);
router.patch('/transport/assignments/:id', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.updateAssignmentSchema }), transport_controller_1.updateAssignment);
router.delete('/transport/assignments/:id', transport_controller_1.deleteAssignment);
// Student Transport Allocations
router.get('/transport/student-allocations', transport_controller_1.getStudentAllocations);
router.post('/transport/student-allocations', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.createStudentAllocationSchema }), transport_controller_1.createStudentAllocation);
router.patch('/transport/student-allocations/:id', (0, validate_middleware_1.validateRequest)({ body: transport_validator_1.updateStudentAllocationSchema }), transport_controller_1.updateStudentAllocation);
router.delete('/transport/student-allocations/:id', transport_controller_1.deleteStudentAllocation);
// Reports & CSV Export
router.get('/transport/reports', transport_controller_1.getTransportReports);
// ==================== LIBRARY MANAGEMENT (PHASE 5.2) ====================
// Dashboard & Settings
router.get('/library/dashboard', library_controller_1.getLibraryDashboard);
router.get('/library/settings', library_controller_1.getLibrarySettings);
router.patch('/library/settings', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updateLibrarySettingsSchema }), library_controller_1.updateLibrarySettings);
// Categories
router.get('/library/categories', library_controller_1.getCategories);
router.post('/library/categories', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createCategorySchema }), library_controller_1.createCategory);
router.patch('/library/categories/:id', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updateCategorySchema }), library_controller_1.updateCategory);
router.delete('/library/categories/:id', library_controller_1.deleteCategory);
// Authors
router.get('/library/authors', library_controller_1.getAuthors);
router.post('/library/authors', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createAuthorSchema }), library_controller_1.createAuthor);
router.patch('/library/authors/:id', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updateAuthorSchema }), library_controller_1.updateAuthor);
router.delete('/library/authors/:id', library_controller_1.deleteAuthor);
// Publishers
router.get('/library/publishers', library_controller_1.getPublishers);
router.post('/library/publishers', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createPublisherSchema }), library_controller_1.createPublisher);
router.patch('/library/publishers/:id', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updatePublisherSchema }), library_controller_1.updatePublisher);
router.delete('/library/publishers/:id', library_controller_1.deletePublisher);
// Book Catalogue
router.get('/library/books', library_controller_1.getBooks);
router.post('/library/books', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createBookSchema }), library_controller_1.createBook);
router.get('/library/books/:id', library_controller_1.getBookById);
router.patch('/library/books/:id', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updateBookSchema }), library_controller_1.updateBook);
router.delete('/library/books/:id', library_controller_1.deleteBook);
// Physical Book Copies
router.get('/library/copies', library_controller_1.getCopies);
router.post('/library/copies', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createCopySchema }), library_controller_1.createCopy);
router.patch('/library/copies/:id', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updateCopySchema }), library_controller_1.updateCopy);
router.delete('/library/copies/:id', library_controller_1.deleteCopy);
// Members
router.get('/library/members', library_controller_1.getMembers);
router.post('/library/members', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createMemberSchema }), library_controller_1.createMember);
router.get('/library/members/:id', library_controller_1.getMemberById);
router.patch('/library/members/:id', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.updateMemberSchema }), library_controller_1.updateMember);
router.delete('/library/members/:id', library_controller_1.deleteMember);
// Book Issues & Returns
router.get('/library/issues', library_controller_1.getIssues);
router.post('/library/issues', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.issueBookSchema }), library_controller_1.issueBook);
router.post('/library/issues/:id/return', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.returnBookSchema }), library_controller_1.returnBook);
router.get('/library/overdue', library_controller_1.getOverdueBooks);
// Fines
router.get('/library/fines', library_controller_1.getFines);
router.post('/library/fines/:id/adjust', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.fineAdjustmentSchema }), library_controller_1.recordFineAdjustment);
router.post('/library/fines/:id/adjustment', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.fineAdjustmentSchema }), library_controller_1.recordFineAdjustment);
// Reservations
router.get('/library/reservations', library_controller_1.getReservations);
router.post('/library/reservations', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.createReservationSchema }), library_controller_1.createReservation);
router.post('/library/reservations/:id/allocate', (0, validate_middleware_1.validateRequest)({ body: library_validator_1.allocateReservationSchema }), library_controller_1.allocateReservation);
router.delete('/library/reservations/:id', library_controller_1.cancelReservation);
// Reports
router.get('/library/reports', library_controller_1.getLibraryReports);
// ==================== INVENTORY & ASSET MANAGEMENT (PHASE 5.3) ====================
// Dashboard & KPIs
router.get('/inventory/dashboard', inventory_controller_1.getInventoryDashboard);
// Categories
router.get('/inventory/categories', inventory_controller_1.listCategories);
router.post('/inventory/categories', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createCategorySchema }), inventory_controller_1.createCategory);
router.get('/inventory/categories/:id', inventory_controller_1.getCategoryById);
router.put('/inventory/categories/:id', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updateCategorySchema }), inventory_controller_1.updateCategory);
router.delete('/inventory/categories/:id', inventory_controller_1.deleteCategory);
// Locations
router.get('/inventory/locations', inventory_controller_1.listLocations);
router.post('/inventory/locations', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createLocationSchema }), inventory_controller_1.createLocation);
router.put('/inventory/locations/:id', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updateLocationSchema }), inventory_controller_1.updateLocation);
router.delete('/inventory/locations/:id', inventory_controller_1.deleteLocation);
// Suppliers
router.get('/inventory/suppliers', inventory_controller_1.listSuppliers);
router.post('/inventory/suppliers', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createSupplierSchema }), inventory_controller_1.createSupplier);
router.put('/inventory/suppliers/:id', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updateSupplierSchema }), inventory_controller_1.updateSupplier);
router.delete('/inventory/suppliers/:id', inventory_controller_1.deleteSupplier);
// Item Catalogue
router.get('/inventory/items', inventory_controller_1.listItems);
router.post('/inventory/items', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createItemSchema }), inventory_controller_1.createItem);
router.get('/inventory/items/:id', inventory_controller_1.getItemById);
router.put('/inventory/items/:id', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updateItemSchema }), inventory_controller_1.updateItem);
router.delete('/inventory/items/:id', inventory_controller_1.deleteItem);
// Stock Movements
router.post('/inventory/stock/inward', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.stockInwardSchema }), inventory_controller_1.recordStockInward);
router.post('/inventory/stock/outward', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.stockOutwardSchema }), inventory_controller_1.recordStockOutward);
router.post('/inventory/stock/adjustment', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.stockAdjustmentSchema }), inventory_controller_1.recordStockAdjustment);
router.post('/inventory/stock/transfer', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.stockTransferSchema }), inventory_controller_1.recordStockTransfer);
router.get('/inventory/stock/movements', inventory_controller_1.listStockMovements);
// Asset Register
router.get('/inventory/assets', inventory_controller_1.listAssets);
router.post('/inventory/assets', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createAssetSchema }), inventory_controller_1.createAsset);
router.get('/inventory/assets/:id', inventory_controller_1.getAssetById);
router.put('/inventory/assets/:id', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updateAssetSchema }), inventory_controller_1.updateAsset);
router.delete('/inventory/assets/:id', inventory_controller_1.deleteAsset);
// Asset Assignment & Return
router.post('/inventory/assets/:id/assign', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.assignAssetSchema }), inventory_controller_1.assignAsset);
router.post('/inventory/assets/:id/return', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.returnAssetSchema }), inventory_controller_1.returnAsset);
router.get('/inventory/assignments', inventory_controller_1.listAssetAssignments);
// Asset Maintenance
router.get('/inventory/maintenance/tickets', inventory_controller_1.listMaintenanceTickets);
router.post('/inventory/maintenance/tickets', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createMaintenanceTicketSchema }), inventory_controller_1.createMaintenanceTicket);
router.get('/inventory/maintenance/tickets/:id', inventory_controller_1.getMaintenanceTicketById);
router.put('/inventory/maintenance/tickets/:id', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updateMaintenanceTicketSchema }), inventory_controller_1.updateMaintenanceTicket);
router.post('/inventory/maintenance/tickets/:id/logs', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.addMaintenanceLogSchema }), inventory_controller_1.addMaintenanceLog);
// Depreciation Engine
router.post('/inventory/depreciation/run', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.runDepreciationSchema }), inventory_controller_1.runDepreciation);
router.get('/inventory/depreciation/history', inventory_controller_1.listDepreciationHistory);
// Purchase Orders & Receiving
router.get('/inventory/purchase-orders', inventory_controller_1.listPurchaseOrders);
router.post('/inventory/purchase-orders', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.createPurchaseOrderSchema }), inventory_controller_1.createPurchaseOrder);
router.get('/inventory/purchase-orders/:id', inventory_controller_1.getPurchaseOrderById);
router.put('/inventory/purchase-orders/:id/status', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.updatePurchaseOrderStatusSchema }), inventory_controller_1.updatePurchaseOrderStatus);
router.post('/inventory/purchase-orders/:id/receive', (0, validate_middleware_1.validateRequest)({ body: inventory_validator_1.receivePurchaseOrderItemsSchema }), inventory_controller_1.receivePurchaseOrderItems);
// Streaming CSV Exports
router.get('/inventory/export/items', inventory_controller_1.exportItemsCsv);
router.get('/inventory/export/stock-movements', inventory_controller_1.exportStockMovementsCsv);
router.get('/inventory/export/assets', inventory_controller_1.exportAssetsCsv);
router.get('/inventory/export/depreciation', inventory_controller_1.exportDepreciationCsv);
router.get('/inventory/export/maintenance', inventory_controller_1.exportMaintenanceCsv);
exports.default = router;
