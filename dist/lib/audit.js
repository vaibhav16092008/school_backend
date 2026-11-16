"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
const prisma_1 = require("./prisma");
async function logAudit({ schoolId, userId, action, resource, resourceId, details, req, }) {
    try {
        const ipAddress = req?.ip || req?.headers['x-forwarded-for']?.toString() || null;
        const userAgent = req?.headers['user-agent'] || null;
        // Use req.tenantId or req.user.schoolId if not explicitly provided
        const resolvedSchoolId = schoolId || req?.tenantId || req?.user?.schoolId || null;
        const resolvedUserId = userId || req?.user?.id || null;
        await prisma_1.prisma.audit_logs.create({
            data: {
                schoolId: resolvedSchoolId,
                userId: resolvedUserId,
                action,
                resource,
                resourceId: resourceId || null,
                details: details ? JSON.parse(JSON.stringify(details)) : undefined,
                ipAddress,
                userAgent,
            },
        });
    }
    catch (error) {
        // Non-blocking: audit failure should not crash main request, but should be reported
        console.error('[AuditLog Error]: Failed to write audit record:', error);
    }
}
