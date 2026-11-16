"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDocument = exports.downloadDocument = exports.getDocuments = exports.uploadDocument = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const uploadDocument = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        if (!req.file) {
            return next(api_error_1.ApiError.badRequest('No file uploaded. Please attach a valid file.'));
        }
        const { studentId, teacherId, name, type } = req.body;
        // Validate that student or teacher belongs to this school
        if (studentId) {
            const student = await prisma_1.prisma.students.findFirst({
                where: { id: studentId, schoolId },
            });
            if (!student) {
                // Clean up uploaded file if student not found
                if (req.file.path && fs_1.default.existsSync(req.file.path)) {
                    fs_1.default.unlinkSync(req.file.path);
                }
                return next(api_error_1.ApiError.notFound('Student not found in your school records'));
            }
        }
        if (teacherId) {
            const teacher = await prisma_1.prisma.teachers.findFirst({
                where: { id: teacherId, schoolId },
            });
            if (!teacher) {
                if (req.file.path && fs_1.default.existsSync(req.file.path)) {
                    fs_1.default.unlinkSync(req.file.path);
                }
                return next(api_error_1.ApiError.notFound('Teacher not found in your school records'));
            }
        }
        const fileUrl = `/uploads/${schoolId}/${req.file.filename}`;
        const docName = name || req.file.originalname;
        const docType = type || 'GENERAL';
        const document = await prisma_1.prisma.$transaction(async (tx) => {
            const doc = await tx.documents.create({
                data: {
                    schoolId,
                    studentId: studentId || null,
                    teacherId: teacherId || null,
                    name: docName,
                    type: docType,
                    fileUrl,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype,
                },
            });
            // If document type is PROFILE_PHOTO, update the entity's avatar/photo
            if (docType === 'PROFILE_PHOTO') {
                if (studentId) {
                    await tx.students.update({
                        where: { id: studentId },
                        data: { photo: fileUrl },
                    });
                }
                else if (teacherId) {
                    await tx.teachers.update({
                        where: { id: teacherId },
                        data: { photo: fileUrl },
                    });
                }
            }
            return doc;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DOCUMENT_UPLOADED',
            resource: 'documents',
            resourceId: document.id,
            details: {
                name: docName,
                type: docType,
                studentId,
                teacherId,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, document, 'Document uploaded successfully', 201);
    }
    catch (error) {
        // Clean up uploaded file if error occurs
        if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { }
        }
        return next(error);
    }
};
exports.uploadDocument = uploadDocument;
const getDocuments = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { studentId, teacherId, type } = req.query;
        const where = { schoolId };
        if (studentId && typeof studentId === 'string') {
            where.studentId = studentId;
        }
        if (teacherId && typeof teacherId === 'string') {
            where.teacherId = teacherId;
        }
        if (type && typeof type === 'string') {
            where.type = type;
        }
        const documents = await prisma_1.prisma.documents.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                students: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                    },
                },
                teachers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, documents);
    }
    catch (error) {
        return next(error);
    }
};
exports.getDocuments = getDocuments;
const downloadDocument = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const documentId = String(req.params.id);
        // 1. Verify authenticated user's school ownership and tenant isolation
        const doc = await prisma_1.prisma.documents.findFirst({
            where: {
                id: documentId,
                schoolId, // Strict tenant check: returns 404 if belonging to another school
            },
            include: {
                students: { select: { id: true, schoolId: true } },
                teachers: { select: { id: true, schoolId: true } },
            },
        });
        if (!doc) {
            // Return 404 for cross-tenant or nonexistent document to prevent enumeration
            return next(api_error_1.ApiError.notFound('Document not found in your school records'));
        }
        // 2. Verify document ownership & resource association if linked
        if (doc.studentId && doc.students && doc.students.schoolId !== schoolId) {
            return next(api_error_1.ApiError.notFound('Document resource association mismatch'));
        }
        if (doc.teacherId && doc.teachers && doc.teachers.schoolId !== schoolId) {
            return next(api_error_1.ApiError.notFound('Document resource association mismatch'));
        }
        // 3. Prevent path traversal and arbitrary file access
        // Extract basename from stored fileUrl (e.g. /uploads/<schoolId>/<filename>)
        const filename = path_1.default.basename(doc.fileUrl);
        // Strict directory boundary: must reside within uploads/<schoolId>
        const tenantDir = path_1.default.resolve(process.cwd(), 'uploads', schoolId);
        const resolvedPath = path_1.default.resolve(tenantDir, filename);
        // Guard: Ensure resolvedPath is strictly inside tenantDir and has no directory traversal
        const relative = path_1.default.relative(tenantDir, resolvedPath);
        if (relative.startsWith('..') || path_1.default.isAbsolute(relative) || !resolvedPath.startsWith(tenantDir)) {
            return next(api_error_1.ApiError.badRequest('Invalid document path'));
        }
        // Check physical file existence on disk
        if (!fs_1.default.existsSync(resolvedPath)) {
            return next(api_error_1.ApiError.notFound('Document file not found on storage'));
        }
        // 4. Return safe content headers
        const safeFilename = path_1.default.basename(doc.name || filename).replace(/["\r\n\\]/g, '_');
        const mimeType = doc.mimeType || 'application/octet-stream';
        const stat = fs_1.default.statSync(resolvedPath);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        // 5. Stream the file securely without exposing server file system paths
        const fileStream = fs_1.default.createReadStream(resolvedPath);
        fileStream.on('error', (err) => {
            if (!res.headersSent) {
                return next(api_error_1.ApiError.internal('Failed to stream document file'));
            }
        });
        fileStream.pipe(res);
    }
    catch (error) {
        return next(error);
    }
};
exports.downloadDocument = downloadDocument;
const deleteDocument = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const documentId = String(req.params.id);
        const doc = await prisma_1.prisma.documents.findFirst({
            where: { id: documentId, schoolId },
        });
        if (!doc) {
            return next(api_error_1.ApiError.notFound('Document not found in your school records'));
        }
        await prisma_1.prisma.documents.delete({
            where: { id: documentId },
        });
        // Try deleting physical file from disk
        try {
            const filePath = path_1.default.resolve(process.cwd(), '.' + doc.fileUrl);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        catch {
            // Ignore disk error if already unlinked
        }
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DOCUMENT_DELETED',
            resource: 'documents',
            resourceId: documentId,
            details: { name: doc.name, type: doc.type, studentId: doc.studentId, teacherId: doc.teacherId },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Document deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteDocument = deleteDocument;
