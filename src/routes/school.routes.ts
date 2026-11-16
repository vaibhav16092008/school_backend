import { Router } from 'express';
import {
  getMySchool,
  updateMySchool,
  getSchoolStats,
} from '../controllers/school.controller';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  archiveStudent,
  deleteStudent,
  promoteStudent,
  getStudentIdCard,
} from '../controllers/student.controller';
import {
  getParents,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
  linkStudentToParent,
  unlinkStudentFromParent,
} from '../controllers/parent.controller';
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacher.controller';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  createSection,
  updateSection,
  deleteSection,
  getSubjects,
  createSubject,
  assignSubjectToClass,
  getAcademicYears,
  createAcademicYear,
  setCurrentAcademicYear,
} from '../controllers/academic.controller';
import {
  uploadDocument,
  getDocuments,
  downloadDocument,
  deleteDocument,
} from '../controllers/document.controller';
import {
  markStudentAttendance,
  getStudentAttendance,
  getStudentAttendanceSummary,
  getStudentMonthlyReport,
  markStaffAttendance,
  getStaffAttendance,
  getStaffAttendanceSummary,
} from '../controllers/attendance.controller';
import {
  getFeeCategories,
  createFeeCategory,
  updateFeeCategory,
  deleteFeeCategory,
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  createInvoice,
  generateBulkInvoices,
  getInvoices,
  getInvoiceById,
  recordPayment,
  getPaymentReceipt,
  recordRefund,
  getFinancialOverview,
  getClassWiseCollectionReport,
  getPaymentMethodBreakdown,
  getPendingFeeDefaulters,
} from '../controllers/fee.controller';
import {
  getGradingScales,
  createGradingScale,
  deleteGradingScale,
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  getExamSchedules,
  createExamSchedule,
  deleteExamSchedule,
  getExamMarksRoster,
  submitExamMarks,
  calculateExamResults,
  getExamResults,
  approveExamResults,
  getStudentReportCard,
} from '../controllers/examination.controller';
import {
  getTimetable,
  createTimetableEntry,
  deleteTimetableEntry,
} from '../controllers/timetable.controller';
import {
  getHomework,
  getHomeworkById,
  createHomework,
  submitHomework,
  evaluateHomework,
  deleteHomework,
} from '../controllers/homework.controller';
import {
  getTransportDashboard,
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  createStop,
  updateStop,
  deleteStop,
  reorderStops,
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  deleteDriver,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getStudentAllocations,
  createStudentAllocation,
  updateStudentAllocation,
  deleteStudentAllocation,
  getTransportReports,
} from '../controllers/transport.controller';
import {
  getLibraryDashboard,
  getLibrarySettings,
  updateLibrarySettings,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAuthors,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  getPublishers,
  createPublisher,
  updatePublisher,
  deletePublisher,
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getCopies,
  createCopy,
  updateCopy,
  deleteCopy,
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
  getIssues,
  issueBook,
  returnBook,
  getOverdueBooks,
  getFines,
  recordFineAdjustment,
  getReservations,
  createReservation,
  allocateReservation,
  cancelReservation,
  getLibraryReports,
} from '../controllers/library.controller';
import {
  getInventoryDashboard,
  listCategories as listInvCategories,
  createCategory as createInvCategory,
  getCategoryById as getInvCategoryById,
  updateCategory as updateInvCategory,
  deleteCategory as deleteInvCategory,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listItems,
  createItem,
  getItemById,
  updateItem,
  deleteItem,
  recordStockInward,
  recordStockOutward,
  recordStockAdjustment,
  recordStockTransfer,
  listStockMovements,
  listAssets,
  createAsset,
  getAssetById,
  updateAsset,
  deleteAsset,
  assignAsset,
  returnAsset,
  listAssetAssignments,
  listMaintenanceTickets,
  createMaintenanceTicket,
  getMaintenanceTicketById,
  updateMaintenanceTicket,
  addMaintenanceLog,
  runDepreciation,
  listDepreciationHistory,
  listPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  receivePurchaseOrderItems,
  exportItemsCsv,
  exportStockMovementsCsv,
  exportAssetsCsv,
  exportDepreciationCsv,
  exportMaintenanceCsv,
} from '../controllers/inventory.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { Role } from '../lib/prisma';
import { validateRequest } from '../middleware/validate.middleware';
import { upload } from '../middleware/upload.middleware';
import { updateSchoolProfileSchema } from '../validators/school.validator';
import {
  createStudentSchema,
  updateStudentSchema,
  promoteStudentSchema,
  createParentSchema,
  updateParentSchema,
  linkParentStudentSchema,
  createTeacherSchema,
  updateTeacherSchema,
  createClassSchema,
  updateClassSchema,
  createSectionSchema,
  updateSectionSchema,
  createSubjectSchema,
  assignSubjectSchema,
  createAcademicYearSchema,
} from '../validators/academic.validator';
import {
  markStudentAttendanceSchema,
  markStaffAttendanceSchema,
} from '../validators/attendance.validator';
import {
  createFeeCategorySchema,
  updateFeeCategorySchema,
  createFeeStructureSchema,
  updateFeeStructureSchema,
  createInvoiceSchema,
  generateBulkInvoicesSchema,
  recordPaymentSchema,
  recordRefundSchema,
} from '../validators/fee.validator';
import {
  createGradingScaleSchema,
  createExamSchema,
  updateExamSchema,
  createExamScheduleSchema,
  submitMarksSchema,
  calculateResultsSchema,
  approveResultsSchema,
} from '../validators/examination.validator';
import { createTimetableEntrySchema } from '../validators/timetable.validator';
import {
  createHomeworkSchema,
  submitHomeworkSchema,
  evaluateHomeworkSchema,
} from '../validators/homework.validator';
import {
  createVehicleSchema,
  updateVehicleSchema,
  createRouteSchema,
  updateRouteSchema,
  createStopSchema,
  updateStopSchema,
  reorderStopsSchema,
  createDriverSchema,
  updateDriverSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  createStudentAllocationSchema,
  updateStudentAllocationSchema,
} from '../validators/transport.validator';
import {
  updateLibrarySettingsSchema,
  createCategorySchema,
  updateCategorySchema,
  createAuthorSchema,
  updateAuthorSchema,
  createPublisherSchema,
  updatePublisherSchema,
  createBookSchema,
  updateBookSchema,
  createCopySchema,
  updateCopySchema,
  createMemberSchema,
  updateMemberSchema,
  issueBookSchema,
  returnBookSchema,
  fineAdjustmentSchema,
  createReservationSchema,
  allocateReservationSchema,
} from '../validators/library.validator';
import {
  createCategorySchema as createInvCategorySchema,
  updateCategorySchema as updateInvCategorySchema,
  createLocationSchema,
  updateLocationSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createItemSchema,
  updateItemSchema,
  stockInwardSchema,
  stockOutwardSchema,
  stockAdjustmentSchema,
  stockTransferSchema,
  createAssetSchema,
  updateAssetSchema,
  assignAssetSchema,
  returnAssetSchema,
  createMaintenanceTicketSchema,
  updateMaintenanceTicketSchema,
  addMaintenanceLogSchema,
  runDepreciationSchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  receivePurchaseOrderItemsSchema,
} from '../validators/inventory.validator';

const router = Router();

// Protect all school routes: Must be authenticated, must be SCHOOL_ADMIN or SUPER_ADMIN, and must pass tenant isolation
router.use(authenticateJwt, requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), requireTenant);

// ==================== SCHOOL INFO & STATS ====================
router.get('/info', getMySchool);
router.patch('/info', validateRequest({ body: updateSchoolProfileSchema }), updateMySchool);
router.get('/stats', getSchoolStats);

// ==================== STUDENTS ====================
router.get('/students', getStudents);
router.post('/students', validateRequest({ body: createStudentSchema }), createStudent);
router.get('/students/:id', getStudentById);
router.patch('/students/:id', validateRequest({ body: updateStudentSchema }), updateStudent);
router.delete('/students/:id', deleteStudent);
router.patch('/students/:id/archive', archiveStudent);
router.post('/students/:id/promote', validateRequest({ body: promoteStudentSchema }), promoteStudent);
router.get('/students/:id/id-card', getStudentIdCard);

// ==================== PARENTS / GUARDIANS ====================
router.get('/parents', getParents);
router.post('/parents', validateRequest({ body: createParentSchema }), createParent);
router.get('/parents/:id', getParentById);
router.patch('/parents/:id', validateRequest({ body: updateParentSchema }), updateParent);
router.delete('/parents/:id', deleteParent);
router.post('/parents/:id/students', validateRequest({ body: linkParentStudentSchema }), linkStudentToParent);
router.delete('/parents/:id/students/:studentId', unlinkStudentFromParent);

// ==================== TEACHERS & STAFF ====================
router.get('/teachers', getTeachers);
router.post('/teachers', validateRequest({ body: createTeacherSchema }), createTeacher);
router.get('/teachers/:id', getTeacherById);
router.patch('/teachers/:id', validateRequest({ body: updateTeacherSchema }), updateTeacher);
router.delete('/teachers/:id', deleteTeacher);

// ==================== CLASSES & SECTIONS ====================
router.get('/classes', getClasses);
router.post('/classes', validateRequest({ body: createClassSchema }), createClass);
router.patch('/classes/:id', validateRequest({ body: updateClassSchema }), updateClass);
router.delete('/classes/:id', deleteClass);

router.post('/classes/:classId/sections', validateRequest({ body: createSectionSchema }), createSection);
router.patch('/sections/:id', validateRequest({ body: updateSectionSchema }), updateSection);
router.delete('/sections/:id', deleteSection);

router.post('/classes/:classId/subjects', validateRequest({ body: assignSubjectSchema }), assignSubjectToClass);

// ==================== ACADEMIC YEARS & SUBJECTS ====================
router.get('/academic-years', getAcademicYears);
router.post('/academic-years', validateRequest({ body: createAcademicYearSchema }), createAcademicYear);
router.patch('/academic-years/:id/current', setCurrentAcademicYear);

router.get('/subjects', getSubjects);
router.post('/subjects', validateRequest({ body: createSubjectSchema }), createSubject);

// ==================== DOCUMENTS & FILE UPLOADS ====================
router.post('/documents/upload', upload.single('file'), uploadDocument);
router.get('/documents', getDocuments);
router.get('/documents/:id/download', downloadDocument);
router.delete('/documents/:id', deleteDocument);

// ==================== STUDENT ATTENDANCE (PHASE 3) ====================
router.post('/attendance/student', validateRequest({ body: markStudentAttendanceSchema }), markStudentAttendance);
router.get('/attendance/student', getStudentAttendance);
router.get('/attendance/student/summary', getStudentAttendanceSummary);
router.get('/attendance/student/monthly', getStudentMonthlyReport);

// ==================== STAFF ATTENDANCE (PHASE 3) ====================
router.post('/attendance/staff', validateRequest({ body: markStaffAttendanceSchema }), markStaffAttendance);
router.get('/attendance/staff', getStaffAttendance);
router.get('/attendance/staff/summary', getStaffAttendanceSummary);

// ==================== FEE MANAGEMENT (PHASE 3) ====================
router.get('/fees/categories', getFeeCategories);
router.post('/fees/categories', validateRequest({ body: createFeeCategorySchema }), createFeeCategory);
router.patch('/fees/categories/:id', validateRequest({ body: updateFeeCategorySchema }), updateFeeCategory);
router.delete('/fees/categories/:id', deleteFeeCategory);

router.get('/fees/structures', getFeeStructures);
router.post('/fees/structures', validateRequest({ body: createFeeStructureSchema }), createFeeStructure);
router.patch('/fees/structures/:id', validateRequest({ body: updateFeeStructureSchema }), updateFeeStructure);
router.delete('/fees/structures/:id', deleteFeeStructure);

router.get('/fees/invoices', getInvoices);
router.post('/fees/invoices', validateRequest({ body: createInvoiceSchema }), createInvoice);
router.post('/fees/invoices/generate-bulk', validateRequest({ body: generateBulkInvoicesSchema }), generateBulkInvoices);
router.get('/fees/invoices/:id', getInvoiceById);
router.post('/fees/invoices/:id/payments', validateRequest({ body: recordPaymentSchema }), recordPayment);

router.get('/fees/payments/:id/receipt', getPaymentReceipt);
router.post('/fees/payments/:id/refund', validateRequest({ body: recordRefundSchema }), recordRefund);

// ==================== FINANCIAL REPORTS (PHASE 3) ====================
router.get('/fees/reports/overview', getFinancialOverview);
router.get('/fees/reports/by-class', getClassWiseCollectionReport);
router.get('/fees/reports/payment-methods', getPaymentMethodBreakdown);
router.get('/fees/reports/defaulters', getPendingFeeDefaulters);

// ==================== EXAMINATION & GRADING (PHASE 4) ====================
router.get('/examinations/grading-scales', getGradingScales);
router.post('/examinations/grading-scales', validateRequest({ body: createGradingScaleSchema }), createGradingScale);
router.delete('/examinations/grading-scales/:id', deleteGradingScale);

router.get('/examinations/exams', getExams);
router.post('/examinations/exams', validateRequest({ body: createExamSchema }), createExam);
router.get('/examinations/exams/:id', getExamById);
router.patch('/examinations/exams/:id', validateRequest({ body: updateExamSchema }), updateExam);
router.delete('/examinations/exams/:id', deleteExam);

router.get('/examinations/schedules', getExamSchedules);
router.post('/examinations/schedules', validateRequest({ body: createExamScheduleSchema }), createExamSchedule);
router.delete('/examinations/schedules/:id', deleteExamSchedule);

router.get('/examinations/schedules/:scheduleId/marks-roster', getExamMarksRoster);
router.post('/examinations/marks', validateRequest({ body: submitMarksSchema }), submitExamMarks);

router.post('/examinations/results/calculate', validateRequest({ body: calculateResultsSchema }), calculateExamResults);
router.get('/examinations/results', getExamResults);
router.post('/examinations/results/approve', validateRequest({ body: approveResultsSchema }), approveExamResults);

router.get('/examinations/report-card', getStudentReportCard);

// ==================== TIMETABLE MANAGEMENT (PHASE 4) ====================
router.get('/timetable', getTimetable);
router.post('/timetable', validateRequest({ body: createTimetableEntrySchema }), createTimetableEntry);
router.delete('/timetable/:id', deleteTimetableEntry);

// ==================== HOMEWORK & ASSIGNMENTS (PHASE 4) ====================
router.get('/homework', getHomework);
router.post('/homework', validateRequest({ body: createHomeworkSchema }), createHomework);
router.get('/homework/:id', getHomeworkById);
router.post('/homework/:id/submit', validateRequest({ body: submitHomeworkSchema }), submitHomework);
router.post('/homework/submissions/:submissionId/evaluate', validateRequest({ body: evaluateHomeworkSchema }), evaluateHomework);
router.delete('/homework/:id', deleteHomework);

// ==================== TRANSPORT MANAGEMENT (PHASE 5.1) ====================
// Dashboard
router.get('/transport/dashboard', getTransportDashboard);

// Vehicles
router.get('/transport/vehicles', getVehicles);
router.post('/transport/vehicles', validateRequest({ body: createVehicleSchema }), createVehicle);
router.get('/transport/vehicles/:id', getVehicleById);
router.patch('/transport/vehicles/:id', validateRequest({ body: updateVehicleSchema }), updateVehicle);
router.delete('/transport/vehicles/:id', deleteVehicle);

// Routes
router.get('/transport/routes', getRoutes);
router.post('/transport/routes', validateRequest({ body: createRouteSchema }), createRoute);
router.get('/transport/routes/:id', getRouteById);
router.patch('/transport/routes/:id', validateRequest({ body: updateRouteSchema }), updateRoute);
router.delete('/transport/routes/:id', deleteRoute);

// Route Stops
router.post('/transport/stops', validateRequest({ body: createStopSchema }), createStop);
router.patch('/transport/stops/:id', validateRequest({ body: updateStopSchema }), updateStop);
router.delete('/transport/stops/:id', deleteStop);
router.post('/transport/stops/reorder', validateRequest({ body: reorderStopsSchema }), reorderStops);

// Drivers
router.get('/transport/drivers', getDrivers);
router.post('/transport/drivers', validateRequest({ body: createDriverSchema }), createDriver);
router.get('/transport/drivers/:id', getDriverById);
router.patch('/transport/drivers/:id', validateRequest({ body: updateDriverSchema }), updateDriver);
router.delete('/transport/drivers/:id', deleteDriver);

// Vehicle & Route Assignments
router.get('/transport/assignments', getAssignments);
router.post('/transport/assignments', validateRequest({ body: createAssignmentSchema }), createAssignment);
router.patch('/transport/assignments/:id', validateRequest({ body: updateAssignmentSchema }), updateAssignment);
router.delete('/transport/assignments/:id', deleteAssignment);

// Student Transport Allocations
router.get('/transport/student-allocations', getStudentAllocations);
router.post('/transport/student-allocations', validateRequest({ body: createStudentAllocationSchema }), createStudentAllocation);
router.patch('/transport/student-allocations/:id', validateRequest({ body: updateStudentAllocationSchema }), updateStudentAllocation);
router.delete('/transport/student-allocations/:id', deleteStudentAllocation);

// Reports & CSV Export
router.get('/transport/reports', getTransportReports);

// ==================== LIBRARY MANAGEMENT (PHASE 5.2) ====================
// Dashboard & Settings
router.get('/library/dashboard', getLibraryDashboard);
router.get('/library/settings', getLibrarySettings);
router.patch('/library/settings', validateRequest({ body: updateLibrarySettingsSchema }), updateLibrarySettings);

// Categories
router.get('/library/categories', getCategories);
router.post('/library/categories', validateRequest({ body: createCategorySchema }), createCategory);
router.patch('/library/categories/:id', validateRequest({ body: updateCategorySchema }), updateCategory);
router.delete('/library/categories/:id', deleteCategory);

// Authors
router.get('/library/authors', getAuthors);
router.post('/library/authors', validateRequest({ body: createAuthorSchema }), createAuthor);
router.patch('/library/authors/:id', validateRequest({ body: updateAuthorSchema }), updateAuthor);
router.delete('/library/authors/:id', deleteAuthor);

// Publishers
router.get('/library/publishers', getPublishers);
router.post('/library/publishers', validateRequest({ body: createPublisherSchema }), createPublisher);
router.patch('/library/publishers/:id', validateRequest({ body: updatePublisherSchema }), updatePublisher);
router.delete('/library/publishers/:id', deletePublisher);

// Book Catalogue
router.get('/library/books', getBooks);
router.post('/library/books', validateRequest({ body: createBookSchema }), createBook);
router.get('/library/books/:id', getBookById);
router.patch('/library/books/:id', validateRequest({ body: updateBookSchema }), updateBook);
router.delete('/library/books/:id', deleteBook);

// Physical Book Copies
router.get('/library/copies', getCopies);
router.post('/library/copies', validateRequest({ body: createCopySchema }), createCopy);
router.patch('/library/copies/:id', validateRequest({ body: updateCopySchema }), updateCopy);
router.delete('/library/copies/:id', deleteCopy);

// Members
router.get('/library/members', getMembers);
router.post('/library/members', validateRequest({ body: createMemberSchema }), createMember);
router.get('/library/members/:id', getMemberById);
router.patch('/library/members/:id', validateRequest({ body: updateMemberSchema }), updateMember);
router.delete('/library/members/:id', deleteMember);

// Book Issues & Returns
router.get('/library/issues', getIssues);
router.post('/library/issues', validateRequest({ body: issueBookSchema }), issueBook);
router.post('/library/issues/:id/return', validateRequest({ body: returnBookSchema }), returnBook);
router.get('/library/overdue', getOverdueBooks);

// Fines
router.get('/library/fines', getFines);
router.post('/library/fines/:id/adjust', validateRequest({ body: fineAdjustmentSchema }), recordFineAdjustment);
router.post('/library/fines/:id/adjustment', validateRequest({ body: fineAdjustmentSchema }), recordFineAdjustment);

// Reservations
router.get('/library/reservations', getReservations);
router.post('/library/reservations', validateRequest({ body: createReservationSchema }), createReservation);
router.post('/library/reservations/:id/allocate', validateRequest({ body: allocateReservationSchema }), allocateReservation);
router.delete('/library/reservations/:id', cancelReservation);

// Reports
router.get('/library/reports', getLibraryReports);

// ==================== INVENTORY & ASSET MANAGEMENT (PHASE 5.3) ====================
// Dashboard & KPIs
router.get('/inventory/dashboard', getInventoryDashboard);

// Categories
router.get('/inventory/categories', listInvCategories);
router.post('/inventory/categories', validateRequest({ body: createInvCategorySchema }), createInvCategory);
router.get('/inventory/categories/:id', getInvCategoryById);
router.put('/inventory/categories/:id', validateRequest({ body: updateInvCategorySchema }), updateInvCategory);
router.delete('/inventory/categories/:id', deleteInvCategory);

// Locations
router.get('/inventory/locations', listLocations);
router.post('/inventory/locations', validateRequest({ body: createLocationSchema }), createLocation);
router.put('/inventory/locations/:id', validateRequest({ body: updateLocationSchema }), updateLocation);
router.delete('/inventory/locations/:id', deleteLocation);

// Suppliers
router.get('/inventory/suppliers', listSuppliers);
router.post('/inventory/suppliers', validateRequest({ body: createSupplierSchema }), createSupplier);
router.put('/inventory/suppliers/:id', validateRequest({ body: updateSupplierSchema }), updateSupplier);
router.delete('/inventory/suppliers/:id', deleteSupplier);

// Item Catalogue
router.get('/inventory/items', listItems);
router.post('/inventory/items', validateRequest({ body: createItemSchema }), createItem);
router.get('/inventory/items/:id', getItemById);
router.put('/inventory/items/:id', validateRequest({ body: updateItemSchema }), updateItem);
router.delete('/inventory/items/:id', deleteItem);

// Stock Movements
router.post('/inventory/stock/inward', validateRequest({ body: stockInwardSchema }), recordStockInward);
router.post('/inventory/stock/outward', validateRequest({ body: stockOutwardSchema }), recordStockOutward);
router.post('/inventory/stock/adjustment', validateRequest({ body: stockAdjustmentSchema }), recordStockAdjustment);
router.post('/inventory/stock/transfer', validateRequest({ body: stockTransferSchema }), recordStockTransfer);
router.get('/inventory/stock/movements', listStockMovements);

// Asset Register
router.get('/inventory/assets', listAssets);
router.post('/inventory/assets', validateRequest({ body: createAssetSchema }), createAsset);
router.get('/inventory/assets/:id', getAssetById);
router.put('/inventory/assets/:id', validateRequest({ body: updateAssetSchema }), updateAsset);
router.delete('/inventory/assets/:id', deleteAsset);

// Asset Assignment & Return
router.post('/inventory/assets/:id/assign', validateRequest({ body: assignAssetSchema }), assignAsset);
router.post('/inventory/assets/:id/return', validateRequest({ body: returnAssetSchema }), returnAsset);
router.get('/inventory/assignments', listAssetAssignments);

// Asset Maintenance
router.get('/inventory/maintenance/tickets', listMaintenanceTickets);
router.post('/inventory/maintenance/tickets', validateRequest({ body: createMaintenanceTicketSchema }), createMaintenanceTicket);
router.get('/inventory/maintenance/tickets/:id', getMaintenanceTicketById);
router.put('/inventory/maintenance/tickets/:id', validateRequest({ body: updateMaintenanceTicketSchema }), updateMaintenanceTicket);
router.post('/inventory/maintenance/tickets/:id/logs', validateRequest({ body: addMaintenanceLogSchema }), addMaintenanceLog);

// Depreciation Engine
router.post('/inventory/depreciation/run', validateRequest({ body: runDepreciationSchema }), runDepreciation);
router.get('/inventory/depreciation/history', listDepreciationHistory);

// Purchase Orders & Receiving
router.get('/inventory/purchase-orders', listPurchaseOrders);
router.post('/inventory/purchase-orders', validateRequest({ body: createPurchaseOrderSchema }), createPurchaseOrder);
router.get('/inventory/purchase-orders/:id', getPurchaseOrderById);
router.put('/inventory/purchase-orders/:id/status', validateRequest({ body: updatePurchaseOrderStatusSchema }), updatePurchaseOrderStatus);
router.post('/inventory/purchase-orders/:id/receive', validateRequest({ body: receivePurchaseOrderItemsSchema }), receivePurchaseOrderItems);

// Streaming CSV Exports
router.get('/inventory/export/items', exportItemsCsv);
router.get('/inventory/export/stock-movements', exportStockMovementsCsv);
router.get('/inventory/export/assets', exportAssetsCsv);
router.get('/inventory/export/depreciation', exportDepreciationCsv);
router.get('/inventory/export/maintenance', exportMaintenanceCsv);

export default router;
