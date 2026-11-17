"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayslipById = exports.markPayrollRecordPaid = exports.finalizePayrollPeriod = exports.addPayrollAdjustment = exports.getPayrollRecords = exports.generatePayroll = exports.createPayrollPeriod = exports.getPayrollPeriods = exports.assignSalaryStructure = exports.updateSalaryStructure = exports.createSalaryStructure = exports.getSalaryStructureById = exports.getSalaryStructures = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const erp_triggers_1 = require("../notifications/erp-triggers");
// ==========================================
// 1. SALARY STRUCTURES & COMPONENTS
// ==========================================
const getSalaryStructures = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const structures = await prisma_1.prisma.salary_structures.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
            include: {
                salary_components: true,
                _count: { select: { employee_salary_assignments: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, structures, 'Salary structures retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getSalaryStructures = getSalaryStructures;
const getSalaryStructureById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const structure = await prisma_1.prisma.salary_structures.findFirst({
            where: { id, schoolId },
            include: {
                salary_components: true,
                employee_salary_assignments: {
                    where: { isActive: true },
                    include: {
                        employee_profiles: {
                            include: {
                                teachers: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
                                departments: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!structure)
            return next(api_error_1.ApiError.notFound('Salary structure not found'));
        return (0, api_response_1.sendSuccess)(res, structure, 'Salary structure retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getSalaryStructureById = getSalaryStructureById;
const createSalaryStructure = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, description, baseSalary, effectiveDate, endDate, components = [] } = req.body;
        const existing = await prisma_1.prisma.salary_structures.findFirst({
            where: { schoolId, name },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Salary structure "${name}" already exists`));
        }
        const structure = await prisma_1.prisma.salary_structures.create({
            data: {
                schoolId,
                name,
                code: code || null,
                description: description || null,
                baseSalary,
                effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                isActive: true,
                salary_components: {
                    create: components.map((c) => ({
                        name: c.name,
                        type: c.type,
                        calculationType: c.calculationType,
                        percentage: c.percentage !== undefined ? c.percentage : null,
                        flatAmount: c.flatAmount !== undefined ? c.flatAmount : null,
                        isTaxable: c.isTaxable !== undefined ? c.isTaxable : true,
                    })),
                },
            },
            include: { salary_components: true },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'SALARY_STRUCTURE_CREATED',
            resource: 'salary_structures',
            resourceId: structure.id,
            details: { name, baseSalary },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, structure, 'Salary structure created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createSalaryStructure = createSalaryStructure;
const updateSalaryStructure = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { name, code, description, baseSalary, isActive, effectiveDate, endDate, components } = req.body;
        const existing = await prisma_1.prisma.salary_structures.findFirst({ where: { id, schoolId } });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Salary structure not found'));
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            if (components && Array.isArray(components)) {
                await tx.salary_components.deleteMany({ where: { salaryStructureId: id } });
                await tx.salary_components.createMany({
                    data: components.map((c) => ({
                        salaryStructureId: id,
                        name: c.name,
                        type: c.type,
                        calculationType: c.calculationType,
                        percentage: c.percentage !== undefined ? c.percentage : null,
                        flatAmount: c.flatAmount !== undefined ? c.flatAmount : null,
                        isTaxable: c.isTaxable !== undefined ? c.isTaxable : true,
                    })),
                });
            }
            return tx.salary_structures.update({
                where: { id },
                data: {
                    ...(name ? { name } : {}),
                    ...(code !== undefined ? { code } : {}),
                    ...(description !== undefined ? { description } : {}),
                    ...(baseSalary !== undefined ? { baseSalary } : {}),
                    ...(typeof isActive === 'boolean' ? { isActive } : {}),
                    ...(effectiveDate ? { effectiveDate: new Date(effectiveDate) } : {}),
                    ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
                },
                include: { salary_components: true },
            });
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Salary structure updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateSalaryStructure = updateSalaryStructure;
const assignSalaryStructure = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { employeeProfileId, salaryStructureId, customBaseSalary, effectiveFrom, effectiveTo } = req.body;
        const [profile, structure] = await Promise.all([
            prisma_1.prisma.employee_profiles.findFirst({ where: { id: employeeProfileId, schoolId } }),
            prisma_1.prisma.salary_structures.findFirst({ where: { id: salaryStructureId, schoolId } }),
        ]);
        if (!profile)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        if (!structure)
            return next(api_error_1.ApiError.notFound('Salary structure not found'));
        // Deactivate existing active assignment
        await prisma_1.prisma.employee_salary_assignments.updateMany({
            where: { schoolId, employeeProfileId, isActive: true },
            data: { isActive: false, effectiveTo: new Date() },
        });
        const assignment = await prisma_1.prisma.employee_salary_assignments.create({
            data: {
                schoolId,
                employeeProfileId,
                salaryStructureId,
                customBaseSalary: customBaseSalary !== undefined ? customBaseSalary : null,
                effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
                effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
                isActive: true,
            },
            include: { salary_structures: { include: { salary_components: true } } },
        });
        return (0, api_response_1.sendSuccess)(res, assignment, 'Salary structure assigned to employee successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.assignSalaryStructure = assignSalaryStructure;
// ==========================================
// 2. PAYROLL PERIODS
// ==========================================
const getPayrollPeriods = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const periods = await prisma_1.prisma.payroll_periods.findMany({
            where: { schoolId },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            include: {
                _count: { select: { payroll_records: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, periods, 'Payroll periods retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getPayrollPeriods = getPayrollPeriods;
const createPayrollPeriod = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { month, year, startDate, endDate, totalWorkingDays } = req.body;
        const existing = await prisma_1.prisma.payroll_periods.findFirst({
            where: { schoolId, month, year },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Payroll period for ${month}/${year} already exists`));
        }
        const period = await prisma_1.prisma.payroll_periods.create({
            data: {
                schoolId,
                month,
                year,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                totalWorkingDays: totalWorkingDays || 30,
                status: prisma_1.PayrollPeriodStatus.DRAFT,
            },
        });
        return (0, api_response_1.sendSuccess)(res, period, 'Payroll period created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createPayrollPeriod = createPayrollPeriod;
// ==========================================
// 3. PAYROLL GENERATION & IMMUTABILITY
// ==========================================
const generatePayroll = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { payrollPeriodId } = req.body;
        const period = await prisma_1.prisma.payroll_periods.findFirst({
            where: { id: payrollPeriodId, schoolId },
        });
        if (!period)
            return next(api_error_1.ApiError.notFound('Payroll period not found'));
        if (period.status === prisma_1.PayrollPeriodStatus.FINALIZED || period.status === prisma_1.PayrollPeriodStatus.PAID) {
            return next(api_error_1.ApiError.badRequest('Finalized payroll periods cannot be regenerated.'));
        }
        // Fetch active employees with active salary structures
        const employees = await prisma_1.prisma.employee_profiles.findMany({
            where: {
                schoolId,
                employmentStatus: 'ACTIVE',
            },
            include: {
                teachers: true,
                employee_salary_assignments: {
                    where: { isActive: true },
                    include: {
                        salary_structures: {
                            include: { salary_components: true },
                        },
                    },
                    take: 1,
                },
            },
        });
        const generatedRecords = [];
        await prisma_1.prisma.$transaction(async (tx) => {
            for (const emp of employees) {
                const assignment = emp.employee_salary_assignments[0];
                if (!assignment || !assignment.salary_structures) {
                    continue; // Skip employees without salary structures configured
                }
                const structure = assignment.salary_structures;
                const baseSalary = Number(assignment.customBaseSalary ?? structure.baseSalary ?? 0);
                // 1. Calculate Earnings
                const itemsToCreate = [];
                let grossEarnings = baseSalary;
                // 2. Attendance & Approved Unpaid Leaves Integration
                const [attendanceRecords, unpaidLeaves] = await Promise.all([
                    tx.staff_attendance.findMany({
                        where: {
                            schoolId,
                            teacherId: emp.teacherId,
                            date: { gte: period.startDate, lte: period.endDate },
                        },
                    }),
                    tx.leave_applications.findMany({
                        where: {
                            schoolId,
                            employeeProfileId: emp.id,
                            status: prisma_1.LeaveStatus.APPROVED,
                            leave_types: { isPaid: false },
                            startDate: { lte: period.endDate },
                            endDate: { gte: period.startDate },
                        },
                    }),
                ]);
                const absentCount = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
                const unpaidLeaveDays = unpaidLeaves.reduce((sum, l) => sum + l.totalDays, 0);
                // Daily Rate for Loss of Pay (LOP)
                const dailyRate = period.totalWorkingDays > 0 ? baseSalary / period.totalWorkingDays : 0;
                const lopDays = absentCount + unpaidLeaveDays;
                const lopDeductionAmount = Math.round(dailyRate * lopDays * 100) / 100;
                let totalDeductions = 0;
                // Process Salary Components
                for (const comp of structure.salary_components) {
                    let compAmount = 0;
                    if (comp.calculationType === prisma_1.CalculationType.FLAT) {
                        compAmount = Number(comp.flatAmount || 0);
                    }
                    else if (comp.calculationType === prisma_1.CalculationType.PERCENTAGE) {
                        const pct = Number(comp.percentage || 0);
                        compAmount = Math.round((baseSalary * (pct / 100)) * 100) / 100;
                    }
                    if (comp.type === prisma_1.ComponentType.EARNING) {
                        grossEarnings += compAmount;
                        itemsToCreate.push({
                            name: comp.name,
                            type: prisma_1.ComponentType.EARNING,
                            amount: compAmount,
                        });
                    }
                    else {
                        totalDeductions += compAmount;
                        itemsToCreate.push({
                            name: comp.name,
                            type: prisma_1.ComponentType.DEDUCTION,
                            amount: compAmount,
                        });
                    }
                }
                // Add LOP Deduction if any
                if (lopDeductionAmount > 0) {
                    totalDeductions += lopDeductionAmount;
                    itemsToCreate.push({
                        name: `Loss of Pay (${lopDays} day${lopDays > 1 ? 's' : ''})`,
                        type: prisma_1.ComponentType.DEDUCTION,
                        amount: lopDeductionAmount,
                        remarks: `${absentCount} absent + ${unpaidLeaveDays} unpaid leave`,
                    });
                }
                const netSalary = Math.max(0, Math.round((grossEarnings - totalDeductions) * 100) / 100);
                // Upsert record for this employee and period
                const record = await tx.payroll_records.upsert({
                    where: {
                        payrollPeriodId_employeeProfileId: {
                            payrollPeriodId: period.id,
                            employeeProfileId: emp.id,
                        },
                    },
                    create: {
                        schoolId,
                        payrollPeriodId: period.id,
                        employeeProfileId: emp.id,
                        baseSalary,
                        grossEarnings,
                        totalDeductions,
                        netSalary,
                        workingDays: period.totalWorkingDays,
                        presentDays: Math.max(0, period.totalWorkingDays - lopDays),
                        absentDays: absentCount,
                        unpaidLeaveDays,
                        status: prisma_1.PayrollStatus.DRAFT,
                    },
                    update: {
                        baseSalary,
                        grossEarnings,
                        totalDeductions,
                        netSalary,
                        workingDays: period.totalWorkingDays,
                        presentDays: Math.max(0, period.totalWorkingDays - lopDays),
                        absentDays: absentCount,
                        unpaidLeaveDays,
                    },
                });
                // Replace breakdown items
                await tx.payroll_items.deleteMany({ where: { payrollRecordId: record.id } });
                await tx.payroll_items.createMany({
                    data: itemsToCreate.map((item) => ({
                        payrollRecordId: record.id,
                        ...item,
                    })),
                });
                generatedRecords.push(record);
            }
            await tx.payroll_periods.update({
                where: { id: period.id },
                data: { status: prisma_1.PayrollPeriodStatus.PROCESSING },
            });
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PAYROLL_GENERATED',
            resource: 'payroll_periods',
            resourceId: period.id,
            details: { totalGenerated: generatedRecords.length },
            req,
        });
        // Notify employees asynchronously
        const notificationPromises = [];
        for (const emp of employees) {
            if (emp.teachers?.userId) {
                const record = generatedRecords.find((r) => r.employeeProfileId === emp.id);
                if (record) {
                    notificationPromises.push(erp_triggers_1.ErpNotificationTriggers.triggerPayrollGenerated(schoolId, emp.teachers.userId, {
                        period: `${period.year}-${period.month.toString().padStart(2, '0')}`,
                        netSalary: `$${record.netSalary}`,
                    }).catch((e) => console.error('[NotificationTrigger] Payroll generated failed:', e)));
                }
            }
        }
        await Promise.all(notificationPromises);
        return (0, api_response_1.sendSuccess)(res, { count: generatedRecords.length, records: generatedRecords }, `Generated payroll for ${generatedRecords.length} employees`, 200);
    }
    catch (error) {
        return next(error);
    }
};
exports.generatePayroll = generatePayroll;
const getPayrollRecords = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const payrollPeriodId = req.query.payrollPeriodId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const skip = (page - 1) * limit;
        const where = {
            schoolId,
            ...(payrollPeriodId ? { payrollPeriodId } : {}),
        };
        const [total, items] = await Promise.all([
            prisma_1.prisma.payroll_records.count({ where }),
            prisma_1.prisma.payroll_records.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    payroll_periods: true,
                    employee_profiles: {
                        include: {
                            teachers: { select: { firstName: true, lastName: true, employeeId: true } },
                            departments: { select: { name: true } },
                            designations: { select: { title: true } },
                        },
                    },
                    payroll_items: true,
                    payroll_adjustments: true,
                    payslips: { select: { id: true, payslipNumber: true } },
                },
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Payroll records retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getPayrollRecords = getPayrollRecords;
const addPayrollAdjustment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { payrollRecordId, type, amount, reason } = req.body;
        const record = await prisma_1.prisma.payroll_records.findFirst({
            where: { id: payrollRecordId, schoolId },
            include: { payroll_periods: true },
        });
        if (!record)
            return next(api_error_1.ApiError.notFound('Payroll record not found'));
        // Check if finalized
        const isFinalized = record.payroll_periods.status === prisma_1.PayrollPeriodStatus.FINALIZED;
        const updatedRecord = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create adjustment entry
            await tx.payroll_adjustments.create({
                data: {
                    schoolId,
                    payrollRecordId,
                    type,
                    amount,
                    reason,
                    adjustedById: req.user.id,
                },
            });
            // 2. Adjust record totals
            let newGross = Number(record.grossEarnings);
            let newDeductions = Number(record.totalDeductions);
            if (type === prisma_1.ComponentType.EARNING) {
                newGross += Number(amount);
            }
            else {
                newDeductions += Number(amount);
            }
            const newNet = Math.max(0, Math.round((newGross - newDeductions) * 100) / 100);
            const upd = await tx.payroll_records.update({
                where: { id: payrollRecordId },
                data: {
                    grossEarnings: newGross,
                    totalDeductions: newDeductions,
                    netSalary: newNet,
                },
                include: { payroll_adjustments: true },
            });
            // If payslip exists, update payslip as well
            await tx.payslips.updateMany({
                where: { payrollRecordId },
                data: {
                    grossSalary: newGross,
                    totalDeductions: newDeductions,
                    netSalary: newNet,
                },
            });
            return upd;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PAYROLL_ADJUSTMENT_ADDED',
            resource: 'payroll_records',
            resourceId: payrollRecordId,
            details: { type, amount, reason, isPostFinalization: isFinalized },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updatedRecord, 'Payroll adjustment added successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.addPayrollAdjustment = addPayrollAdjustment;
const finalizePayrollPeriod = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { payrollPeriodId } = req.body;
        const period = await prisma_1.prisma.payroll_periods.findFirst({
            where: { id: payrollPeriodId, schoolId },
            include: {
                payroll_records: {
                    include: {
                        employee_profiles: {
                            include: { teachers: true },
                        },
                    },
                },
            },
        });
        if (!period)
            return next(api_error_1.ApiError.notFound('Payroll period not found'));
        if (period.status === prisma_1.PayrollPeriodStatus.FINALIZED) {
            return next(api_error_1.ApiError.badRequest('This payroll period has already been finalized'));
        }
        if (period.payroll_records.length === 0) {
            return next(api_error_1.ApiError.badRequest('Cannot finalize a payroll period with 0 generated records'));
        }
        const payslipsToNotify = [];
        await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Lock period to FINALIZED
            await tx.payroll_periods.update({
                where: { id: payrollPeriodId },
                data: {
                    status: prisma_1.PayrollPeriodStatus.FINALIZED,
                    finalizedAt: new Date(),
                    finalizedById: req.user?.id || null,
                },
            });
            // 2. Lock records to FINALIZED & Generate Payslips
            for (const rec of period.payroll_records) {
                await tx.payroll_records.update({
                    where: { id: rec.id },
                    data: { status: prisma_1.PayrollStatus.FINALIZED },
                });
                const payslipNumber = `PS-${period.year}${String(period.month).padStart(2, '0')}-${rec.employee_profiles.teachers.employeeId}`;
                await tx.payslips.upsert({
                    where: { payrollRecordId: rec.id },
                    create: {
                        schoolId,
                        payrollRecordId: rec.id,
                        employeeProfileId: rec.employeeProfileId,
                        payslipNumber,
                        month: period.month,
                        year: period.year,
                        grossSalary: rec.grossEarnings,
                        totalDeductions: rec.totalDeductions,
                        netSalary: rec.netSalary,
                        paymentStatus: prisma_1.PayrollStatus.FINALIZED,
                    },
                    update: {
                        grossSalary: rec.grossEarnings,
                        totalDeductions: rec.totalDeductions,
                        netSalary: rec.netSalary,
                    },
                });
                if (rec.employee_profiles?.teachers?.userId) {
                    payslipsToNotify.push({
                        userId: rec.employee_profiles.teachers.userId,
                        payslipNumber,
                        month: period.month,
                        year: period.year,
                        netSalary: String(rec.netSalary),
                    });
                }
            }
        });
        // Dispatch notifications safely outside the database transaction
        await Promise.all(payslipsToNotify.map((p) => erp_triggers_1.ErpNotificationTriggers.triggerPayslipPublished(schoolId, p.userId, {
            payslipNumber: p.payslipNumber,
            month: p.month,
            year: p.year,
            netSalary: p.netSalary,
        }).catch((e) => console.error('[NotificationTrigger] Payslip published notification failed:', e))));
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PAYROLL_PERIOD_FINALIZED',
            resource: 'payroll_periods',
            resourceId: payrollPeriodId,
            details: { recordsCount: period.payroll_records.length },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Payroll period finalized and payslips published successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.finalizePayrollPeriod = finalizePayrollPeriod;
const markPayrollRecordPaid = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { payrollRecordId, paymentDate, paymentMethod = 'BANK_TRANSFER', transactionReference } = req.body;
        const record = await prisma_1.prisma.payroll_records.findFirst({
            where: { id: payrollRecordId, schoolId },
            include: {
                employee_profiles: { include: { teachers: true } },
                payslips: true,
            },
        });
        if (!record)
            return next(api_error_1.ApiError.notFound('Payroll record not found'));
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const rec = await tx.payroll_records.update({
                where: { id: payrollRecordId },
                data: {
                    status: prisma_1.PayrollStatus.PAID,
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                    paymentMethod,
                    transactionReference: transactionReference || null,
                },
            });
            if (record.payslips) {
                await tx.payslips.update({
                    where: { id: record.payslips.id },
                    data: { paymentStatus: prisma_1.PayrollStatus.PAID },
                });
            }
            return rec;
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Payroll record marked as paid successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.markPayrollRecordPaid = markPayrollRecordPaid;
// ==========================================
// 4. PAYSLIPS
// ==========================================
const getPayslipById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const payslip = await prisma_1.prisma.payslips.findFirst({
            where: {
                OR: [{ id }, { payrollRecordId: id }],
                schoolId,
            },
            include: {
                schools: { select: { id: true, name: true, logo: true, address: true, email: true, phone: true } },
                payroll_records: {
                    include: {
                        payroll_items: true,
                        payroll_adjustments: true,
                    },
                },
                employee_profiles: {
                    include: {
                        teachers: { select: { id: true, firstName: true, lastName: true, employeeId: true, email: true, phone: true } },
                        departments: { select: { name: true } },
                        designations: { select: { title: true } },
                    },
                },
            },
        });
        if (!payslip)
            return next(api_error_1.ApiError.notFound('Payslip not found'));
        // Check IDOR if employee role
        if (req.user?.role === 'TEACHER') {
            const teacher = await prisma_1.prisma.teachers.findUnique({ where: { userId: req.user.id } });
            if (payslip.employee_profiles.teachers.id !== teacher?.id) {
                return next(api_error_1.ApiError.forbidden('You do not have permission to view another employee payslip'));
            }
        }
        return (0, api_response_1.sendSuccess)(res, payslip, 'Payslip retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getPayslipById = getPayslipById;
