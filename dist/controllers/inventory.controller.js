"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportMaintenanceCsv = exports.exportDepreciationCsv = exports.exportAssetsCsv = exports.exportStockMovementsCsv = exports.exportItemsCsv = exports.receivePurchaseOrderItems = exports.updatePurchaseOrderStatus = exports.getPurchaseOrderById = exports.createPurchaseOrder = exports.listPurchaseOrders = exports.listDepreciationHistory = exports.runDepreciation = exports.addMaintenanceLog = exports.updateMaintenanceTicket = exports.getMaintenanceTicketById = exports.createMaintenanceTicket = exports.listMaintenanceTickets = exports.listAssetAssignments = exports.returnAsset = exports.assignAsset = exports.deleteAsset = exports.updateAsset = exports.getAssetById = exports.createAsset = exports.listAssets = exports.listStockMovements = exports.recordStockTransfer = exports.recordStockAdjustment = exports.recordStockOutward = exports.recordStockInward = exports.deleteItem = exports.updateItem = exports.getItemById = exports.createItem = exports.listItems = exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.listSuppliers = exports.deleteLocation = exports.updateLocation = exports.createLocation = exports.listLocations = exports.deleteCategory = exports.updateCategory = exports.getCategoryById = exports.createCategory = exports.listCategories = exports.getInventoryDashboard = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// Helper: Escape CSV fields
function escapeCsv(value) {
    if (value === null || value === undefined)
        return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
}
// Helper: Generate Random Code suffix
function generateCode(prefix) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${ts}-${rand}`;
}
// ==========================================
// 1. INVENTORY DASHBOARD & KPIS
// ==========================================
const getInventoryDashboard = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const [totalItems, consumablesCount, assetsCatalogueCount, totalAssetsRegistered, totalMaintenanceOpen, pendingPOs, allAssets, lowStockItems, recentMovements,] = await Promise.all([
            prisma_1.prisma.inventory_items.count({ where: { schoolId, isActive: true } }),
            prisma_1.prisma.inventory_items.count({
                where: { schoolId, isActive: true, itemType: prisma_1.InventoryItemType.CONSUMABLE },
            }),
            prisma_1.prisma.inventory_items.count({
                where: { schoolId, isActive: true, itemType: prisma_1.InventoryItemType.ASSET },
            }),
            prisma_1.prisma.inventory_assets.count({ where: { schoolId } }),
            prisma_1.prisma.inventory_maintenance_tickets.count({
                where: {
                    schoolId,
                    status: { in: [prisma_1.MaintenanceStatus.OPEN, prisma_1.MaintenanceStatus.IN_PROGRESS, prisma_1.MaintenanceStatus.ON_HOLD] },
                },
            }),
            prisma_1.prisma.inventory_purchase_orders.count({
                where: {
                    schoolId,
                    status: { in: [prisma_1.PurchaseOrderStatus.DRAFT, prisma_1.PurchaseOrderStatus.ORDERED, prisma_1.PurchaseOrderStatus.PARTIALLY_RECEIVED] },
                },
            }),
            prisma_1.prisma.inventory_assets.findMany({
                where: { schoolId },
                select: { currentBookValue: true, purchasePrice: true, status: true },
            }),
            prisma_1.prisma.inventory_items.findMany({
                where: {
                    schoolId,
                    isActive: true,
                },
                include: {
                    category: { select: { name: true } },
                    primaryLocation: { select: { name: true } },
                },
                orderBy: { currentStock: 'asc' },
                take: 50,
            }),
            prisma_1.prisma.inventory_stock_movements.findMany({
                where: { schoolId },
                include: {
                    item: { select: { name: true, sku: true, unitOfMeasurement: true } },
                    performedBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);
        // Calculate total asset valuation
        const totalAssetValuation = allAssets.reduce((sum, a) => sum + Number(a.currentBookValue || 0), 0);
        const totalPurchaseValuation = allAssets.reduce((sum, a) => sum + Number(a.purchasePrice || 0), 0);
        // Filter items where currentStock <= minStockThreshold
        const realLowStockItems = lowStockItems.filter((i) => i.currentStock <= i.minStockThreshold);
        return (0, api_response_1.sendSuccess)(res, {
            metrics: {
                totalItems,
                consumablesCount,
                assetsCatalogueCount,
                totalAssetsRegistered,
                totalAssetValuation,
                totalPurchaseValuation,
                lowStockCount: realLowStockItems.length,
                openMaintenanceTickets: totalMaintenanceOpen,
                pendingPurchaseOrders: pendingPOs,
            },
            lowStockAlerts: realLowStockItems.slice(0, 10),
            recentMovements,
        }, 'Inventory dashboard fetched successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.getInventoryDashboard = getInventoryDashboard;
// ==========================================
// 2. CATEGORIES CONTROLLERS
// ==========================================
const listCategories = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const search = req.query.search;
        const where = { schoolId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        const categories = await prisma_1.prisma.inventory_categories.findMany({
            where,
            include: {
                _count: { select: { items: true } },
            },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, categories, 'Categories retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listCategories = listCategories;
const createCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, description, isActive } = req.body;
        let code = req.body.code ? String(req.body.code).trim().toUpperCase() : '';
        if (!code) {
            code = name
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '_')
                .slice(0, 20);
        }
        const existing = await prisma_1.prisma.inventory_categories.findFirst({
            where: {
                schoolId,
                OR: [{ name: { equals: name, mode: 'insensitive' } }, { code }],
            },
        });
        if (existing) {
            throw new api_error_1.ApiError(409, 'A category with this name or code already exists in your school');
        }
        const category = await prisma_1.prisma.inventory_categories.create({
            data: {
                schoolId,
                name,
                code,
                description,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'CREATE_INVENTORY_CATEGORY',
            resource: 'inventory_categories',
            resourceId: category.id,
            details: { name, code },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, category, 'Category created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createCategory = createCategory;
const getCategoryById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const category = await prisma_1.prisma.inventory_categories.findFirst({
            where: { id, schoolId },
            include: {
                items: {
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        itemType: true,
                        currentStock: true,
                        unitOfMeasurement: true,
                    },
                },
            },
        });
        if (!category) {
            throw new api_error_1.ApiError(404, 'Category not found');
        }
        return (0, api_response_1.sendSuccess)(res, category, 'Category retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.getCategoryById = getCategoryById;
const updateCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const { name, code, description, isActive } = req.body;
        const category = await prisma_1.prisma.inventory_categories.findFirst({
            where: { id, schoolId },
        });
        if (!category) {
            throw new api_error_1.ApiError(404, 'Category not found');
        }
        const updated = await prisma_1.prisma.inventory_categories.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(code !== undefined && { code: String(code).trim().toUpperCase() }),
                ...(description !== undefined && { description }),
                ...(isActive !== undefined && { isActive }),
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'UPDATE_INVENTORY_CATEGORY',
            resource: 'inventory_categories',
            resourceId: updated.id,
            details: req.body,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Category updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const category = await prisma_1.prisma.inventory_categories.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { items: true } } },
        });
        if (!category) {
            throw new api_error_1.ApiError(404, 'Category not found');
        }
        if (category._count.items > 0) {
            throw new api_error_1.ApiError(400, 'Cannot delete category that contains items. Reassign or delete items first.');
        }
        await prisma_1.prisma.inventory_categories.delete({ where: { id } });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DELETE_INVENTORY_CATEGORY',
            resource: 'inventory_categories',
            resourceId: id,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Category deleted successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteCategory = deleteCategory;
// ==========================================
// 3. LOCATIONS CONTROLLERS
// ==========================================
const listLocations = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const search = req.query.search;
        const where = { schoolId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { building: { contains: search, mode: 'insensitive' } },
            ];
        }
        const locations = await prisma_1.prisma.inventory_locations.findMany({
            where,
            include: {
                _count: { select: { items: true, assets: true } },
            },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, locations, 'Locations retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listLocations = listLocations;
const createLocation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, building, floor, roomNumber, description, isActive } = req.body;
        let code = req.body.code ? String(req.body.code).trim().toUpperCase() : '';
        if (!code) {
            code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
        }
        const existing = await prisma_1.prisma.inventory_locations.findFirst({
            where: { schoolId, code },
        });
        if (existing) {
            throw new api_error_1.ApiError(409, 'A location with this code already exists in your school');
        }
        const location = await prisma_1.prisma.inventory_locations.create({
            data: {
                schoolId,
                name,
                code,
                building,
                floor,
                roomNumber,
                description,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'CREATE_INVENTORY_LOCATION',
            resource: 'inventory_locations',
            resourceId: location.id,
            details: { name, code },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, location, 'Location created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createLocation = createLocation;
const updateLocation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const location = await prisma_1.prisma.inventory_locations.findFirst({
            where: { id, schoolId },
        });
        if (!location) {
            throw new api_error_1.ApiError(404, 'Location not found');
        }
        const updated = await prisma_1.prisma.inventory_locations.update({
            where: { id },
            data: {
                ...(req.body.name !== undefined && { name: req.body.name }),
                ...(req.body.code !== undefined && { code: String(req.body.code).trim().toUpperCase() }),
                ...(req.body.building !== undefined && { building: req.body.building }),
                ...(req.body.floor !== undefined && { floor: req.body.floor }),
                ...(req.body.roomNumber !== undefined && { roomNumber: req.body.roomNumber }),
                ...(req.body.description !== undefined && { description: req.body.description }),
                ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Location updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.updateLocation = updateLocation;
const deleteLocation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const location = await prisma_1.prisma.inventory_locations.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { items: true, assets: true } } },
        });
        if (!location) {
            throw new api_error_1.ApiError(404, 'Location not found');
        }
        if (location._count.items > 0 || location._count.assets > 0) {
            throw new api_error_1.ApiError(400, 'Cannot delete location with linked items or assets');
        }
        await prisma_1.prisma.inventory_locations.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Location deleted successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteLocation = deleteLocation;
// ==========================================
// 4. SUPPLIERS CONTROLLERS
// ==========================================
const listSuppliers = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const search = req.query.search;
        const where = { schoolId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }
        const suppliers = await prisma_1.prisma.inventory_suppliers.findMany({
            where,
            include: {
                _count: { select: { items: true, assets: true, purchaseOrders: true } },
            },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, suppliers, 'Suppliers retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listSuppliers = listSuppliers;
const createSupplier = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, contactPerson, email, phone, address, gstin, notes, isActive } = req.body;
        const existing = await prisma_1.prisma.inventory_suppliers.findFirst({
            where: { schoolId, name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) {
            throw new api_error_1.ApiError(409, 'A supplier with this name already exists in your school');
        }
        const supplier = await prisma_1.prisma.inventory_suppliers.create({
            data: {
                schoolId,
                name,
                code: code ? String(code).trim().toUpperCase() : null,
                contactPerson,
                email: email || null,
                phone,
                address,
                gstin,
                notes,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'CREATE_INVENTORY_SUPPLIER',
            resource: 'inventory_suppliers',
            resourceId: supplier.id,
            details: { name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, supplier, 'Supplier created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createSupplier = createSupplier;
const updateSupplier = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const supplier = await prisma_1.prisma.inventory_suppliers.findFirst({
            where: { id, schoolId },
        });
        if (!supplier) {
            throw new api_error_1.ApiError(404, 'Supplier not found');
        }
        const updated = await prisma_1.prisma.inventory_suppliers.update({
            where: { id },
            data: {
                ...(req.body.name !== undefined && { name: req.body.name }),
                ...(req.body.code !== undefined && { code: req.body.code ? String(req.body.code).trim().toUpperCase() : null }),
                ...(req.body.contactPerson !== undefined && { contactPerson: req.body.contactPerson }),
                ...(req.body.email !== undefined && { email: req.body.email || null }),
                ...(req.body.phone !== undefined && { phone: req.body.phone }),
                ...(req.body.address !== undefined && { address: req.body.address }),
                ...(req.body.gstin !== undefined && { gstin: req.body.gstin }),
                ...(req.body.notes !== undefined && { notes: req.body.notes }),
                ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Supplier updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.updateSupplier = updateSupplier;
const deleteSupplier = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const supplier = await prisma_1.prisma.inventory_suppliers.findFirst({
            where: { id, schoolId },
            include: {
                _count: { select: { items: true, assets: true, purchaseOrders: true } },
            },
        });
        if (!supplier) {
            throw new api_error_1.ApiError(404, 'Supplier not found');
        }
        if (supplier._count.items > 0 || supplier._count.assets > 0 || supplier._count.purchaseOrders > 0) {
            throw new api_error_1.ApiError(400, 'Cannot delete supplier with linked items, assets, or purchase orders');
        }
        await prisma_1.prisma.inventory_suppliers.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Supplier deleted successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteSupplier = deleteSupplier;
// ==========================================
// 5. ITEM CATALOGUE CONTROLLERS
// ==========================================
const listItems = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { search, categoryId, itemType, lowStock, page = '1', limit = '20', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { modelNumber: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (categoryId) {
            where.categoryId = categoryId;
        }
        if (itemType && Object.values(prisma_1.InventoryItemType).includes(itemType)) {
            where.itemType = itemType;
        }
        const [total, items] = await Promise.all([
            prisma_1.prisma.inventory_items.count({ where }),
            prisma_1.prisma.inventory_items.findMany({
                where,
                include: {
                    category: { select: { id: true, name: true, code: true } },
                    primaryLocation: { select: { id: true, name: true, building: true } },
                    primarySupplier: { select: { id: true, name: true } },
                },
                orderBy: { name: 'asc' },
                skip,
                take: limitNum,
            }),
        ]);
        let finalItems = items;
        if (lowStock === 'true') {
            finalItems = items.filter((i) => i.currentStock <= i.minStockThreshold);
        }
        return (0, api_response_1.sendSuccess)(res, {
            items: finalItems,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Inventory items retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listItems = listItems;
const createItem = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { name, sku, categoryId, itemType, description, brand, modelNumber, unitOfMeasurement, purchasePrice, minStockThreshold, primaryLocationId, primarySupplierId, initialStock = 0, purchaseDate, warrantyExpiry, isActive, } = req.body;
        const category = await prisma_1.prisma.inventory_categories.findFirst({
            where: { id: categoryId, schoolId },
        });
        if (!category) {
            throw new api_error_1.ApiError(404, 'Category not found in your school');
        }
        const existingSku = await prisma_1.prisma.inventory_items.findFirst({
            where: { schoolId, sku },
        });
        if (existingSku) {
            throw new api_error_1.ApiError(409, `An item with SKU "${sku}" already exists in your school`);
        }
        const item = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.inventory_items.create({
                data: {
                    schoolId,
                    categoryId,
                    primaryLocationId: primaryLocationId || null,
                    primarySupplierId: primarySupplierId || null,
                    name,
                    sku,
                    description,
                    brand,
                    modelNumber,
                    unitOfMeasurement: unitOfMeasurement || 'PCS',
                    itemType: itemType || prisma_1.InventoryItemType.CONSUMABLE,
                    purchasePrice: purchasePrice || 0,
                    currentStock: initialStock || 0,
                    minStockThreshold: minStockThreshold !== undefined ? minStockThreshold : 5,
                    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                    warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
                    isActive: isActive !== undefined ? isActive : true,
                },
                include: {
                    category: true,
                    primaryLocation: true,
                    primarySupplier: true,
                },
            });
            if (initialStock > 0) {
                await tx.inventory_stock_movements.create({
                    data: {
                        schoolId,
                        itemId: created.id,
                        movementType: prisma_1.StockMovementType.INWARD,
                        quantity: initialStock,
                        previousQuantity: 0,
                        newQuantity: initialStock,
                        unitPrice: purchasePrice || 0,
                        reason: 'Initial Opening Stock',
                        performedById: userId || null,
                    },
                });
            }
            return created;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'CREATE_INVENTORY_ITEM',
            resource: 'inventory_items',
            resourceId: item.id,
            details: { sku, name, initialStock },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, item, 'Item created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createItem = createItem;
const getItemById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const item = await prisma_1.prisma.inventory_items.findFirst({
            where: { id, schoolId },
            include: {
                category: true,
                primaryLocation: true,
                primarySupplier: true,
                movements: {
                    include: {
                        performedBy: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                assets: {
                    select: {
                        id: true,
                        assetNumber: true,
                        name: true,
                        status: true,
                        condition: true,
                        currentBookValue: true,
                    },
                },
            },
        });
        if (!item) {
            throw new api_error_1.ApiError(404, 'Item not found');
        }
        return (0, api_response_1.sendSuccess)(res, item, 'Item retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.getItemById = getItemById;
const updateItem = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const item = await prisma_1.prisma.inventory_items.findFirst({
            where: { id, schoolId },
        });
        if (!item) {
            throw new api_error_1.ApiError(404, 'Item not found');
        }
        if (req.body.sku && req.body.sku !== item.sku) {
            const conflict = await prisma_1.prisma.inventory_items.findFirst({
                where: { schoolId, sku: req.body.sku },
            });
            if (conflict) {
                throw new api_error_1.ApiError(409, `An item with SKU "${req.body.sku}" already exists`);
            }
        }
        const updated = await prisma_1.prisma.inventory_items.update({
            where: { id },
            data: {
                ...(req.body.name !== undefined && { name: req.body.name }),
                ...(req.body.sku !== undefined && { sku: req.body.sku }),
                ...(req.body.categoryId !== undefined && { categoryId: req.body.categoryId }),
                ...(req.body.itemType !== undefined && { itemType: req.body.itemType }),
                ...(req.body.description !== undefined && { description: req.body.description }),
                ...(req.body.brand !== undefined && { brand: req.body.brand }),
                ...(req.body.modelNumber !== undefined && { modelNumber: req.body.modelNumber }),
                ...(req.body.unitOfMeasurement !== undefined && { unitOfMeasurement: req.body.unitOfMeasurement }),
                ...(req.body.purchasePrice !== undefined && { purchasePrice: req.body.purchasePrice }),
                ...(req.body.minStockThreshold !== undefined && { minStockThreshold: req.body.minStockThreshold }),
                ...(req.body.primaryLocationId !== undefined && { primaryLocationId: req.body.primaryLocationId }),
                ...(req.body.primarySupplierId !== undefined && { primarySupplierId: req.body.primarySupplierId }),
                ...(req.body.purchaseDate !== undefined && { purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : null }),
                ...(req.body.warrantyExpiry !== undefined && { warrantyExpiry: req.body.warrantyExpiry ? new Date(req.body.warrantyExpiry) : null }),
                ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Item updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.updateItem = updateItem;
const deleteItem = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const item = await prisma_1.prisma.inventory_items.findFirst({
            where: { id, schoolId },
            include: {
                _count: { select: { movements: true, assets: true, purchaseOrderItems: true } },
            },
        });
        if (!item) {
            throw new api_error_1.ApiError(404, 'Item not found');
        }
        if (item._count.movements > 0 || item._count.assets > 0 || item._count.purchaseOrderItems > 0) {
            await prisma_1.prisma.inventory_items.update({
                where: { id },
                data: { isActive: false },
            });
            return (0, api_response_1.sendSuccess)(res, null, 'Item has associated historical movements or assets and was deactivated instead of deleted');
        }
        await prisma_1.prisma.inventory_items.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Item deleted successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteItem = deleteItem;
// ==========================================
// 6. STOCK MOVEMENTS (INWARD, OUTWARD, ADJUST, TRANSFER)
// ==========================================
const recordStockInward = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { itemId, quantity, unitPrice, targetLocationId, referenceNumber, batchNumber, reason } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const item = await tx.inventory_items.findFirst({
                where: { id: itemId, schoolId },
            });
            if (!item) {
                throw new api_error_1.ApiError(404, 'Item not found in your school');
            }
            const prevQty = item.currentStock;
            const newQty = prevQty + quantity;
            const updatedItem = await tx.inventory_items.update({
                where: { id: itemId },
                data: {
                    currentStock: newQty,
                    ...(unitPrice !== undefined && unitPrice !== null && { purchasePrice: unitPrice }),
                },
            });
            const movement = await tx.inventory_stock_movements.create({
                data: {
                    schoolId,
                    itemId,
                    movementType: prisma_1.StockMovementType.INWARD,
                    quantity,
                    previousQuantity: prevQty,
                    newQuantity: newQty,
                    unitPrice: unitPrice ?? item.purchasePrice,
                    referenceNumber,
                    batchNumber,
                    reason: reason || 'Stock Inward Receipt',
                    targetLocationId: targetLocationId || item.primaryLocationId,
                    performedById: userId || null,
                },
            });
            return { item: updatedItem, movement };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'STOCK_INWARD',
            resource: 'inventory_stock_movements',
            resourceId: result.movement.id,
            details: { itemId, quantity, newStock: result.item.currentStock },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Stock inward recorded successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.recordStockInward = recordStockInward;
const recordStockOutward = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { itemId, quantity, sourceLocationId, referenceNumber, reason } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const item = await tx.inventory_items.findFirst({
                where: { id: itemId, schoolId },
            });
            if (!item) {
                throw new api_error_1.ApiError(404, 'Item not found in your school');
            }
            if (item.currentStock < quantity) {
                throw new api_error_1.ApiError(400, `Insufficient stock. Available: ${item.currentStock} ${item.unitOfMeasurement}, requested: ${quantity} ${item.unitOfMeasurement}`);
            }
            const prevQty = item.currentStock;
            const newQty = prevQty - quantity;
            const updatedItem = await tx.inventory_items.update({
                where: { id: itemId },
                data: { currentStock: newQty },
            });
            const movement = await tx.inventory_stock_movements.create({
                data: {
                    schoolId,
                    itemId,
                    movementType: prisma_1.StockMovementType.OUTWARD,
                    quantity,
                    previousQuantity: prevQty,
                    newQuantity: newQty,
                    unitPrice: item.purchasePrice,
                    referenceNumber,
                    reason: reason || 'Stock Issue / Outward',
                    sourceLocationId: sourceLocationId || item.primaryLocationId,
                    performedById: userId || null,
                },
            });
            return { item: updatedItem, movement };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'STOCK_OUTWARD',
            resource: 'inventory_stock_movements',
            resourceId: result.movement.id,
            details: { itemId, quantity, remainingStock: result.item.currentStock },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Stock outward recorded successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.recordStockOutward = recordStockOutward;
const recordStockAdjustment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { itemId, countedQuantity, reason, referenceNumber } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const item = await tx.inventory_items.findFirst({
                where: { id: itemId, schoolId },
            });
            if (!item) {
                throw new api_error_1.ApiError(404, 'Item not found in your school');
            }
            const prevQty = item.currentStock;
            const diff = countedQuantity - prevQty;
            const updatedItem = await tx.inventory_items.update({
                where: { id: itemId },
                data: { currentStock: countedQuantity },
            });
            const movement = await tx.inventory_stock_movements.create({
                data: {
                    schoolId,
                    itemId,
                    movementType: prisma_1.StockMovementType.ADJUSTMENT,
                    quantity: Math.abs(diff),
                    previousQuantity: prevQty,
                    newQuantity: countedQuantity,
                    unitPrice: item.purchasePrice,
                    referenceNumber,
                    reason: `Physical count adjustment (${diff >= 0 ? '+' : ''}${diff}): ${reason}`,
                    performedById: userId || null,
                },
            });
            return { item: updatedItem, movement };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'STOCK_ADJUSTMENT',
            resource: 'inventory_stock_movements',
            resourceId: result.movement.id,
            details: { itemId, countedQuantity, adjustmentReason: reason },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Stock adjustment recorded successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.recordStockAdjustment = recordStockAdjustment;
const recordStockTransfer = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { itemId, sourceLocationId, targetLocationId, quantity, notes } = req.body;
        if (sourceLocationId === targetLocationId) {
            throw new api_error_1.ApiError(400, 'Source and target location cannot be the same');
        }
        const [sourceLoc, targetLoc] = await Promise.all([
            prisma_1.prisma.inventory_locations.findFirst({ where: { id: sourceLocationId, schoolId } }),
            prisma_1.prisma.inventory_locations.findFirst({ where: { id: targetLocationId, schoolId } }),
        ]);
        if (!sourceLoc || !targetLoc) {
            throw new api_error_1.ApiError(404, 'Source or destination location not found');
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const item = await tx.inventory_items.findFirst({
                where: { id: itemId, schoolId },
            });
            if (!item) {
                throw new api_error_1.ApiError(404, 'Item not found in your school');
            }
            if (item.currentStock < quantity) {
                throw new api_error_1.ApiError(400, `Insufficient stock to transfer. Current stock: ${item.currentStock}`);
            }
            const transferNumber = generateCode('TRF');
            const transfer = await tx.inventory_stock_transfers.create({
                data: {
                    schoolId,
                    transferNumber,
                    itemId,
                    sourceLocationId,
                    targetLocationId,
                    quantity,
                    status: prisma_1.TransferStatus.COMPLETED,
                    notes,
                    requestedById: userId || null,
                    approvedById: userId || null,
                },
            });
            const movement = await tx.inventory_stock_movements.create({
                data: {
                    schoolId,
                    itemId,
                    movementType: prisma_1.StockMovementType.TRANSFER,
                    quantity,
                    previousQuantity: item.currentStock,
                    newQuantity: item.currentStock,
                    referenceNumber: transferNumber,
                    sourceLocationId,
                    targetLocationId,
                    reason: `Transfer from ${sourceLoc.name} to ${targetLoc.name}: ${notes || 'Stock relocation'}`,
                    performedById: userId || null,
                },
            });
            return { transfer, movement };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'STOCK_TRANSFER',
            resource: 'inventory_stock_transfers',
            resourceId: result.transfer.id,
            details: { itemId, quantity, from: sourceLoc.name, to: targetLoc.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Stock transfer completed successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.recordStockTransfer = recordStockTransfer;
const listStockMovements = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { itemId, movementType, startDate, endDate, page = '1', limit = '30', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (itemId) {
            where.itemId = itemId;
        }
        if (movementType && Object.values(prisma_1.StockMovementType).includes(movementType)) {
            where.movementType = movementType;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }
        const [total, movements] = await Promise.all([
            prisma_1.prisma.inventory_stock_movements.count({ where }),
            prisma_1.prisma.inventory_stock_movements.findMany({
                where,
                include: {
                    item: { select: { id: true, name: true, sku: true, unitOfMeasurement: true } },
                    performedBy: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            movements,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Stock movements retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listStockMovements = listStockMovements;
// ==========================================
// 7. ASSET REGISTER CONTROLLERS
// ==========================================
const listAssets = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { search, status, condition, locationId, department, page = '1', limit = '20', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { assetNumber: { contains: search, mode: 'insensitive' } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (status && Object.values(prisma_1.AssetStatus).includes(status)) {
            where.status = status;
        }
        if (condition && Object.values(prisma_1.AssetCondition).includes(condition)) {
            where.condition = condition;
        }
        if (locationId) {
            where.locationId = locationId;
        }
        if (department) {
            where.department = { contains: department, mode: 'insensitive' };
        }
        const [total, assets] = await Promise.all([
            prisma_1.prisma.inventory_assets.count({ where }),
            prisma_1.prisma.inventory_assets.findMany({
                where,
                include: {
                    location: { select: { id: true, name: true, building: true } },
                    supplier: { select: { id: true, name: true } },
                    item: { select: { id: true, name: true, sku: true } },
                    assignments: {
                        where: { isReturned: false },
                        include: {
                            teacher: { select: { id: true, firstName: true, lastName: true } },
                            user: { select: { id: true, name: true } },
                        },
                        take: 1,
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            assets,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Assets retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listAssets = listAssets;
const createAsset = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { name, serialNumber, brand, modelNumber, department, itemId, supplierId, locationId, purchaseDate, purchasePrice, salvageValue = 0, usefulLifeMonths = 36, depreciationMethod = prisma_1.DepreciationMethod.STRAIGHT_LINE, warrantyExpiry, warrantyDetails, condition = prisma_1.AssetCondition.NEW, status = prisma_1.AssetStatus.AVAILABLE, notes, } = req.body;
        let assetNumber = req.body.assetNumber ? String(req.body.assetNumber).trim() : '';
        if (!assetNumber) {
            assetNumber = generateCode('AST');
        }
        const existing = await prisma_1.prisma.inventory_assets.findFirst({
            where: { schoolId, assetNumber },
        });
        if (existing) {
            throw new api_error_1.ApiError(409, `An asset with asset number "${assetNumber}" already exists in your school`);
        }
        const asset = await prisma_1.prisma.inventory_assets.create({
            data: {
                schoolId,
                assetNumber,
                name,
                serialNumber,
                brand,
                modelNumber,
                department,
                itemId: itemId || null,
                supplierId: supplierId || null,
                locationId: locationId || null,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
                purchasePrice: purchasePrice,
                currentBookValue: purchasePrice,
                accumulatedDepreciation: 0,
                salvageValue,
                usefulLifeMonths,
                depreciationMethod,
                warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
                warrantyDetails,
                condition,
                status,
                notes,
            },
            include: {
                location: true,
                supplier: true,
                item: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'CREATE_INVENTORY_ASSET',
            resource: 'inventory_assets',
            resourceId: asset.id,
            details: { assetNumber, name, purchasePrice },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, asset, 'Asset registered successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createAsset = createAsset;
const getAssetById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const asset = await prisma_1.prisma.inventory_assets.findFirst({
            where: { id, schoolId },
            include: {
                location: true,
                supplier: true,
                item: { include: { category: true } },
                assignments: {
                    include: {
                        teacher: { select: { id: true, firstName: true, lastName: true } },
                        user: { select: { id: true, name: true } },
                    },
                    orderBy: { assignedDate: 'desc' },
                },
                maintenanceTickets: {
                    include: {
                        logs: { orderBy: { createdAt: 'desc' } },
                    },
                    orderBy: { openedAt: 'desc' },
                },
                depreciations: {
                    orderBy: { periodEndDate: 'desc' },
                },
            },
        });
        if (!asset) {
            throw new api_error_1.ApiError(404, 'Asset not found');
        }
        return (0, api_response_1.sendSuccess)(res, asset, 'Asset details retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.getAssetById = getAssetById;
const updateAsset = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const asset = await prisma_1.prisma.inventory_assets.findFirst({
            where: { id, schoolId },
        });
        if (!asset) {
            throw new api_error_1.ApiError(404, 'Asset not found');
        }
        const updated = await prisma_1.prisma.inventory_assets.update({
            where: { id },
            data: {
                ...(req.body.name !== undefined && { name: req.body.name }),
                ...(req.body.serialNumber !== undefined && { serialNumber: req.body.serialNumber }),
                ...(req.body.brand !== undefined && { brand: req.body.brand }),
                ...(req.body.modelNumber !== undefined && { modelNumber: req.body.modelNumber }),
                ...(req.body.department !== undefined && { department: req.body.department }),
                ...(req.body.itemId !== undefined && { itemId: req.body.itemId || null }),
                ...(req.body.supplierId !== undefined && { supplierId: req.body.supplierId || null }),
                ...(req.body.locationId !== undefined && { locationId: req.body.locationId || null }),
                ...(req.body.purchaseDate !== undefined && { purchaseDate: new Date(req.body.purchaseDate) }),
                ...(req.body.purchasePrice !== undefined && { purchasePrice: req.body.purchasePrice }),
                ...(req.body.salvageValue !== undefined && { salvageValue: req.body.salvageValue }),
                ...(req.body.usefulLifeMonths !== undefined && { usefulLifeMonths: req.body.usefulLifeMonths }),
                ...(req.body.depreciationMethod !== undefined && { depreciationMethod: req.body.depreciationMethod }),
                ...(req.body.warrantyExpiry !== undefined && { warrantyExpiry: req.body.warrantyExpiry ? new Date(req.body.warrantyExpiry) : null }),
                ...(req.body.warrantyDetails !== undefined && { warrantyDetails: req.body.warrantyDetails }),
                ...(req.body.condition !== undefined && { condition: req.body.condition }),
                ...(req.body.status !== undefined && { status: req.body.status }),
                ...(req.body.notes !== undefined && { notes: req.body.notes }),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Asset updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.updateAsset = updateAsset;
const deleteAsset = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const asset = await prisma_1.prisma.inventory_assets.findFirst({
            where: { id, schoolId },
            include: {
                _count: { select: { assignments: true, maintenanceTickets: true, depreciations: true } },
            },
        });
        if (!asset) {
            throw new api_error_1.ApiError(404, 'Asset not found');
        }
        if (asset._count.assignments > 0 ||
            asset._count.maintenanceTickets > 0 ||
            asset._count.depreciations > 0) {
            await prisma_1.prisma.inventory_assets.update({
                where: { id },
                data: { status: prisma_1.AssetStatus.DISPOSED },
            });
            return (0, api_response_1.sendSuccess)(res, null, 'Asset has historical records; marked as DISPOSED instead of deleted');
        }
        await prisma_1.prisma.inventory_assets.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Asset deleted successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.deleteAsset = deleteAsset;
// ==========================================
// 8. ASSET ASSIGNMENT & RETURN
// ==========================================
const assignAsset = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const assetId = req.params.id;
        const { teacherId, userId: targetUserId, department, locationId, assignedDate, expectedReturnDate, assignedCondition = prisma_1.AssetCondition.GOOD, assignmentRemarks, } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const asset = await tx.inventory_assets.findFirst({
                where: { id: assetId, schoolId },
            });
            if (!asset) {
                throw new api_error_1.ApiError(404, 'Asset not found');
            }
            if (asset.status !== prisma_1.AssetStatus.AVAILABLE) {
                throw new api_error_1.ApiError(400, `Cannot assign asset. Current asset status is ${asset.status}`);
            }
            const assignment = await tx.inventory_asset_assignments.create({
                data: {
                    schoolId,
                    assetId,
                    teacherId: teacherId || null,
                    userId: targetUserId || null,
                    department,
                    locationId: locationId || asset.locationId,
                    assignedDate: assignedDate ? new Date(assignedDate) : new Date(),
                    expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
                    assignedCondition,
                    assignmentRemarks,
                    assignedById: userId || null,
                    isReturned: false,
                },
            });
            const updatedAsset = await tx.inventory_assets.update({
                where: { id: assetId },
                data: {
                    status: prisma_1.AssetStatus.ASSIGNED,
                    condition: assignedCondition,
                    ...(department && { department }),
                },
            });
            return { assignment, asset: updatedAsset };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'ASSIGN_INVENTORY_ASSET',
            resource: 'inventory_asset_assignments',
            resourceId: result.assignment.id,
            details: { assetId, teacherId, department },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Asset assigned successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.assignAsset = assignAsset;
const returnAsset = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const assetId = req.params.id;
        const { returnCondition = prisma_1.AssetCondition.GOOD, returnDate, locationId, returnRemarks, } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const asset = await tx.inventory_assets.findFirst({
                where: { id: assetId, schoolId },
            });
            if (!asset) {
                throw new api_error_1.ApiError(404, 'Asset not found');
            }
            const activeAssignment = await tx.inventory_asset_assignments.findFirst({
                where: { assetId, schoolId, isReturned: false },
                orderBy: { assignedDate: 'desc' },
            });
            if (!activeAssignment) {
                throw new api_error_1.ApiError(400, 'No active unreturned assignment found for this asset');
            }
            const updatedAssignment = await tx.inventory_asset_assignments.update({
                where: { id: activeAssignment.id },
                data: {
                    isReturned: true,
                    returnDate: returnDate ? new Date(returnDate) : new Date(),
                    returnCondition,
                    returnRemarks,
                    receivedById: userId || null,
                },
            });
            const nextStatus = returnCondition === prisma_1.AssetCondition.DAMAGED
                ? prisma_1.AssetStatus.DAMAGED
                : prisma_1.AssetStatus.AVAILABLE;
            const updatedAsset = await tx.inventory_assets.update({
                where: { id: assetId },
                data: {
                    status: nextStatus,
                    condition: returnCondition,
                    ...(locationId && { locationId }),
                },
            });
            return { assignment: updatedAssignment, asset: updatedAsset };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'RETURN_INVENTORY_ASSET',
            resource: 'inventory_asset_assignments',
            resourceId: result.assignment.id,
            details: { assetId, returnCondition },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Asset returned successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.returnAsset = returnAsset;
const listAssetAssignments = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { assetId, isReturned, page = '1', limit = '25', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (assetId)
            where.assetId = assetId;
        if (isReturned !== undefined)
            where.isReturned = isReturned === 'true';
        const [total, assignments] = await Promise.all([
            prisma_1.prisma.inventory_asset_assignments.count({ where }),
            prisma_1.prisma.inventory_asset_assignments.findMany({
                where,
                include: {
                    asset: { select: { id: true, assetNumber: true, name: true } },
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                    user: { select: { id: true, name: true } },
                },
                orderBy: { assignedDate: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            assignments,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Asset assignments retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listAssetAssignments = listAssetAssignments;
// ==========================================
// 9. ASSET MAINTENANCE TICKETS
// ==========================================
const listMaintenanceTickets = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { assetId, status, priority, page = '1', limit = '20', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (assetId)
            where.assetId = assetId;
        if (status && Object.values(prisma_1.MaintenanceStatus).includes(status)) {
            where.status = status;
        }
        if (priority && Object.values(prisma_1.MaintenancePriority).includes(priority)) {
            where.priority = priority;
        }
        const [total, tickets] = await Promise.all([
            prisma_1.prisma.inventory_maintenance_tickets.count({ where }),
            prisma_1.prisma.inventory_maintenance_tickets.findMany({
                where,
                include: {
                    asset: { select: { id: true, assetNumber: true, name: true, status: true } },
                    supplier: { select: { id: true, name: true, phone: true } },
                    logs: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
                orderBy: { openedAt: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            tickets,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Maintenance tickets retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listMaintenanceTickets = listMaintenanceTickets;
const createMaintenanceTicket = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { assetId, title, issueDescription, priority = prisma_1.MaintenancePriority.MEDIUM, assignedStaffId, supplierId, estimatedCost = 0, workNotes, } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const asset = await tx.inventory_assets.findFirst({
                where: { id: assetId, schoolId },
            });
            if (!asset) {
                throw new api_error_1.ApiError(404, 'Asset not found in your school');
            }
            const ticketNumber = generateCode('MNT');
            const ticket = await tx.inventory_maintenance_tickets.create({
                data: {
                    schoolId,
                    ticketNumber,
                    assetId,
                    supplierId: supplierId || null,
                    reportedById: userId || null,
                    assignedStaffId: assignedStaffId || null,
                    title,
                    issueDescription,
                    priority,
                    status: prisma_1.MaintenanceStatus.OPEN,
                    estimatedCost,
                    workNotes,
                },
            });
            await tx.inventory_assets.update({
                where: { id: assetId },
                data: { status: prisma_1.AssetStatus.UNDER_MAINTENANCE },
            });
            await tx.inventory_maintenance_logs.create({
                data: {
                    ticketId: ticket.id,
                    previousStatus: null,
                    newStatus: prisma_1.MaintenanceStatus.OPEN,
                    note: `Maintenance ticket logged: ${title}`,
                    actionCost: estimatedCost,
                    performedById: userId || null,
                },
            });
            return ticket;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'CREATE_MAINTENANCE_TICKET',
            resource: 'inventory_maintenance_tickets',
            resourceId: result.id,
            details: { assetId, title, priority },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Maintenance ticket created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createMaintenanceTicket = createMaintenanceTicket;
const getMaintenanceTicketById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const ticket = await prisma_1.prisma.inventory_maintenance_tickets.findFirst({
            where: { id, schoolId },
            include: {
                asset: {
                    include: {
                        location: true,
                    },
                },
                supplier: true,
                logs: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!ticket) {
            throw new api_error_1.ApiError(404, 'Maintenance ticket not found');
        }
        return (0, api_response_1.sendSuccess)(res, ticket, 'Maintenance ticket retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.getMaintenanceTicketById = getMaintenanceTicketById;
const updateMaintenanceTicket = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const id = req.params.id;
        const { title, issueDescription, status, priority, assignedStaffId, supplierId, actualCost, workNotes, } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const ticket = await tx.inventory_maintenance_tickets.findFirst({
                where: { id, schoolId },
            });
            if (!ticket) {
                throw new api_error_1.ApiError(404, 'Maintenance ticket not found');
            }
            const prevStatus = ticket.status;
            const isClosingOrResolving = status &&
                (status === prisma_1.MaintenanceStatus.RESOLVED || status === prisma_1.MaintenanceStatus.CLOSED);
            const resolvedAt = isClosingOrResolving && !ticket.resolvedAt ? new Date() : ticket.resolvedAt;
            const closedAt = status === prisma_1.MaintenanceStatus.CLOSED && !ticket.closedAt ? new Date() : ticket.closedAt;
            const updated = await tx.inventory_maintenance_tickets.update({
                where: { id },
                data: {
                    ...(title !== undefined && { title }),
                    ...(issueDescription !== undefined && { issueDescription }),
                    ...(status !== undefined && { status }),
                    ...(priority !== undefined && { priority }),
                    ...(assignedStaffId !== undefined && { assignedStaffId }),
                    ...(supplierId !== undefined && { supplierId: supplierId || null }),
                    ...(actualCost !== undefined && { actualCost }),
                    ...(workNotes !== undefined && { workNotes }),
                    resolvedAt,
                    closedAt,
                },
            });
            if (status && status !== prevStatus) {
                await tx.inventory_maintenance_logs.create({
                    data: {
                        ticketId: id,
                        previousStatus: prevStatus,
                        newStatus: status,
                        note: `Status updated to ${status}. ${workNotes || ''}`,
                        actionCost: actualCost,
                        performedById: userId || null,
                    },
                });
                if (isClosingOrResolving) {
                    const asset = await tx.inventory_assets.findUnique({
                        where: { id: ticket.assetId },
                    });
                    if (asset && asset.status === prisma_1.AssetStatus.UNDER_MAINTENANCE) {
                        await tx.inventory_assets.update({
                            where: { id: ticket.assetId },
                            data: {
                                status: asset.condition === prisma_1.AssetCondition.DAMAGED
                                    ? prisma_1.AssetStatus.DAMAGED
                                    : prisma_1.AssetStatus.AVAILABLE,
                            },
                        });
                    }
                }
            }
            return updated;
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Maintenance ticket updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.updateMaintenanceTicket = updateMaintenanceTicket;
const addMaintenanceLog = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const ticketId = req.params.id;
        const { newStatus, note, actionCost = 0 } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const ticket = await tx.inventory_maintenance_tickets.findFirst({
                where: { id: ticketId, schoolId },
            });
            if (!ticket) {
                throw new api_error_1.ApiError(404, 'Maintenance ticket not found');
            }
            const prevStatus = ticket.status;
            const log = await tx.inventory_maintenance_logs.create({
                data: {
                    ticketId,
                    previousStatus: prevStatus,
                    newStatus,
                    note,
                    actionCost,
                    performedById: userId || null,
                },
            });
            const nextActualCost = Number(ticket.actualCost || 0) + Number(actionCost || 0);
            await tx.inventory_maintenance_tickets.update({
                where: { id: ticketId },
                data: {
                    status: newStatus,
                    actualCost: nextActualCost,
                },
            });
            return log;
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Maintenance log added successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.addMaintenanceLog = addMaintenanceLog;
// ==========================================
// 10. DEPRECIATION ENGINE
// ==========================================
const runDepreciation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { fiscalYear, periodStartDate, periodEndDate, assetIds, remarks } = req.body;
        const pStart = new Date(periodStartDate);
        const pEnd = new Date(periodEndDate);
        const where = {
            schoolId,
            status: { notIn: [prisma_1.AssetStatus.DISPOSED, prisma_1.AssetStatus.LOST] },
        };
        if (assetIds && assetIds.length > 0) {
            where.id = { in: assetIds };
        }
        const eligibleAssets = await prisma_1.prisma.inventory_assets.findMany({ where });
        if (eligibleAssets.length === 0) {
            return (0, api_response_1.sendSuccess)(res, {
                processedCount: 0,
                depreciations: [],
            }, 'No eligible assets found for depreciation run');
        }
        const processedLogs = [];
        await prisma_1.prisma.$transaction(async (tx) => {
            for (const asset of eligibleAssets) {
                const purchasePrice = Number(asset.purchasePrice || 0);
                const salvageValue = Number(asset.salvageValue || 0);
                const currentBookValue = Number(asset.currentBookValue || 0);
                const usefulMonths = asset.usefulLifeMonths || 36;
                const usefulYears = Math.max(1, usefulMonths / 12);
                if (currentBookValue <= salvageValue) {
                    continue;
                }
                let depreciationAmount = 0;
                let ratePercentage = null;
                if (asset.depreciationMethod === prisma_1.DepreciationMethod.STRAIGHT_LINE) {
                    const annualDep = (purchasePrice - salvageValue) / usefulYears;
                    ratePercentage = Number(((1 / usefulYears) * 100).toFixed(2));
                    depreciationAmount = Math.min(annualDep, currentBookValue - salvageValue);
                }
                else if (asset.depreciationMethod === prisma_1.DepreciationMethod.WRITTEN_DOWN_VALUE) {
                    const ratio = Math.max(1, salvageValue) / Math.max(1, purchasePrice);
                    const computedRate = 1 - Math.pow(ratio, 1 / usefulYears);
                    const clampedRate = Math.max(0.05, Math.min(computedRate, 0.40));
                    ratePercentage = Number((clampedRate * 100).toFixed(2));
                    const wdvDep = currentBookValue * clampedRate;
                    depreciationAmount = Math.min(wdvDep, currentBookValue - salvageValue);
                }
                depreciationAmount = Math.max(0, Number(depreciationAmount.toFixed(2)));
                if (depreciationAmount <= 0) {
                    continue;
                }
                const closingBookValue = Number((currentBookValue - depreciationAmount).toFixed(2));
                const newAccumulated = Number((Number(asset.accumulatedDepreciation || 0) + depreciationAmount).toFixed(2));
                const depRecord = await tx.inventory_depreciations.create({
                    data: {
                        schoolId,
                        assetId: asset.id,
                        fiscalYear,
                        periodStartDate: pStart,
                        periodEndDate: pEnd,
                        depreciationMethod: asset.depreciationMethod,
                        openingBookValue: currentBookValue,
                        depreciationAmount,
                        closingBookValue,
                        ratePercentage,
                        calculationRemarks: remarks || `${asset.depreciationMethod} depreciation for FY ${fiscalYear}`,
                        calculatedById: userId || null,
                    },
                });
                await tx.inventory_assets.update({
                    where: { id: asset.id },
                    data: {
                        currentBookValue: closingBookValue,
                        accumulatedDepreciation: newAccumulated,
                        lastDepreciationDate: pEnd,
                    },
                });
                processedLogs.push(depRecord);
            }
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'RUN_DEPRECIATION',
            resource: 'inventory_depreciations',
            details: { fiscalYear, processedAssets: processedLogs.length },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, {
            processedCount: processedLogs.length,
            depreciations: processedLogs,
        }, `Depreciation run processed for ${processedLogs.length} assets`);
    }
    catch (err) {
        next(err);
    }
};
exports.runDepreciation = runDepreciation;
const listDepreciationHistory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { fiscalYear, assetId, page = '1', limit = '30', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (fiscalYear)
            where.fiscalYear = fiscalYear;
        if (assetId)
            where.assetId = assetId;
        const [total, records] = await Promise.all([
            prisma_1.prisma.inventory_depreciations.count({ where }),
            prisma_1.prisma.inventory_depreciations.findMany({
                where,
                include: {
                    asset: {
                        select: {
                            id: true,
                            assetNumber: true,
                            name: true,
                            purchasePrice: true,
                            currentBookValue: true,
                        },
                    },
                },
                orderBy: { periodEndDate: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            records,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Depreciation history retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listDepreciationHistory = listDepreciationHistory;
// ==========================================
// 11. PURCHASE ORDERS & RECEIVING
// ==========================================
const listPurchaseOrders = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { status, supplierId, page = '1', limit = '20', } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
        const skip = (pageNum - 1) * limitNum;
        const where = { schoolId };
        if (status && Object.values(prisma_1.PurchaseOrderStatus).includes(status)) {
            where.status = status;
        }
        if (supplierId) {
            where.supplierId = supplierId;
        }
        const [total, purchaseOrders] = await Promise.all([
            prisma_1.prisma.inventory_purchase_orders.count({ where }),
            prisma_1.prisma.inventory_purchase_orders.findMany({
                where,
                include: {
                    supplier: { select: { id: true, name: true, phone: true } },
                    _count: { select: { items: true } },
                },
                orderBy: { orderDate: 'desc' },
                skip,
                take: limitNum,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            purchaseOrders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        }, 'Purchase orders retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.listPurchaseOrders = listPurchaseOrders;
const createPurchaseOrder = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const { supplierId, orderDate, expectedDeliveryDate, notes, items } = req.body;
        const supplier = await prisma_1.prisma.inventory_suppliers.findFirst({
            where: { id: supplierId, schoolId },
        });
        if (!supplier) {
            throw new api_error_1.ApiError(404, 'Supplier not found in your school');
        }
        let poNumber = req.body.poNumber ? String(req.body.poNumber).trim() : '';
        if (!poNumber) {
            poNumber = generateCode('PO');
        }
        const itemIds = items.map((i) => i.itemId);
        const foundItems = await prisma_1.prisma.inventory_items.findMany({
            where: { id: { in: itemIds }, schoolId },
        });
        if (foundItems.length !== itemIds.length) {
            throw new api_error_1.ApiError(400, 'One or more items in the purchase order do not exist');
        }
        let subtotal = 0;
        let taxAmount = 0;
        const itemData = items.map((i) => {
            const lineSub = Number(i.orderedQuantity) * Number(i.unitPrice);
            const lineTax = (lineSub * Number(i.taxRate || 0)) / 100;
            subtotal += lineSub;
            taxAmount += lineTax;
            return {
                itemId: i.itemId,
                orderedQuantity: i.orderedQuantity,
                receivedQuantity: 0,
                unitPrice: i.unitPrice,
                taxRate: i.taxRate || 0,
                totalPrice: lineSub + lineTax,
            };
        });
        const totalAmount = subtotal + taxAmount;
        const purchaseOrder = await prisma_1.prisma.inventory_purchase_orders.create({
            data: {
                schoolId,
                poNumber,
                supplierId,
                orderDate: orderDate ? new Date(orderDate) : new Date(),
                expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
                subtotal,
                taxAmount,
                totalAmount,
                status: prisma_1.PurchaseOrderStatus.DRAFT,
                notes,
                createdById: userId || null,
                items: {
                    create: itemData,
                },
            },
            include: {
                supplier: true,
                items: {
                    include: {
                        item: { select: { id: true, name: true, sku: true, unitOfMeasurement: true } },
                    },
                },
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'CREATE_PURCHASE_ORDER',
            resource: 'inventory_purchase_orders',
            resourceId: purchaseOrder.id,
            details: { poNumber, totalAmount, supplierId },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, purchaseOrder, 'Purchase order created successfully', 201);
    }
    catch (err) {
        next(err);
    }
};
exports.createPurchaseOrder = createPurchaseOrder;
const getPurchaseOrderById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const po = await prisma_1.prisma.inventory_purchase_orders.findFirst({
            where: { id, schoolId },
            include: {
                supplier: true,
                items: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        if (!po) {
            throw new api_error_1.ApiError(404, 'Purchase order not found');
        }
        return (0, api_response_1.sendSuccess)(res, po, 'Purchase order retrieved successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.getPurchaseOrderById = getPurchaseOrderById;
const updatePurchaseOrderStatus = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = req.params.id;
        const { status, notes } = req.body;
        const po = await prisma_1.prisma.inventory_purchase_orders.findFirst({
            where: { id, schoolId },
        });
        if (!po) {
            throw new api_error_1.ApiError(404, 'Purchase order not found');
        }
        const updated = await prisma_1.prisma.inventory_purchase_orders.update({
            where: { id },
            data: {
                status,
                ...(notes && { notes: po.notes ? `${po.notes}\n${notes}` : notes }),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, `Purchase order status updated to ${status}`);
    }
    catch (err) {
        next(err);
    }
};
exports.updatePurchaseOrderStatus = updatePurchaseOrderStatus;
const receivePurchaseOrderItems = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        const poId = req.params.id;
        const { items, notes } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const po = await tx.inventory_purchase_orders.findFirst({
                where: { id: poId, schoolId },
                include: { items: true },
            });
            if (!po) {
                throw new api_error_1.ApiError(404, 'Purchase order not found');
            }
            if (po.status === prisma_1.PurchaseOrderStatus.CANCELLED) {
                throw new api_error_1.ApiError(400, 'Cannot receive items against a CANCELLED purchase order');
            }
            for (const rec of items) {
                const poItem = po.items.find((i) => i.id === rec.poItemId);
                if (!poItem) {
                    throw new api_error_1.ApiError(400, `PO Item ID ${rec.poItemId} not found on this purchase order`);
                }
                const newRecQty = poItem.receivedQuantity + rec.receivedQuantity;
                if (newRecQty > poItem.orderedQuantity) {
                    throw new api_error_1.ApiError(400, `Cannot receive more than ordered quantity. Ordered: ${poItem.orderedQuantity}, previously received: ${poItem.receivedQuantity}, attempted: ${rec.receivedQuantity}`);
                }
                await tx.inventory_purchase_order_items.update({
                    where: { id: poItem.id },
                    data: { receivedQuantity: newRecQty },
                });
                const item = await tx.inventory_items.findFirst({
                    where: { id: poItem.itemId, schoolId },
                });
                if (item) {
                    const prevQty = item.currentStock;
                    const newQty = prevQty + rec.receivedQuantity;
                    await tx.inventory_items.update({
                        where: { id: item.id },
                        data: { currentStock: newQty },
                    });
                    await tx.inventory_stock_movements.create({
                        data: {
                            schoolId,
                            itemId: item.id,
                            movementType: prisma_1.StockMovementType.INWARD,
                            quantity: rec.receivedQuantity,
                            previousQuantity: prevQty,
                            newQuantity: newQty,
                            unitPrice: poItem.unitPrice,
                            referenceNumber: po.poNumber,
                            reason: `PO ${po.poNumber} Goods Receipt: ${notes || 'Delivery accepted'}`,
                            targetLocationId: rec.targetLocationId || item.primaryLocationId,
                            performedById: userId || null,
                        },
                    });
                }
            }
            const updatedPoItems = await tx.inventory_purchase_order_items.findMany({
                where: { purchaseOrderId: poId },
            });
            const allFullyReceived = updatedPoItems.every((i) => i.receivedQuantity >= i.orderedQuantity);
            const someReceived = updatedPoItems.some((i) => i.receivedQuantity > 0);
            const nextStatus = allFullyReceived
                ? prisma_1.PurchaseOrderStatus.RECEIVED
                : someReceived
                    ? prisma_1.PurchaseOrderStatus.PARTIALLY_RECEIVED
                    : po.status;
            const updatedPo = await tx.inventory_purchase_orders.update({
                where: { id: poId },
                data: {
                    status: nextStatus,
                    deliveryDate: allFullyReceived ? new Date() : po.deliveryDate,
                },
                include: { items: true },
            });
            return updatedPo;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId,
            action: 'RECEIVE_PO_ITEMS',
            resource: 'inventory_purchase_orders',
            resourceId: result.id,
            details: { poNumber: result.poNumber, status: result.status },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Purchase order items received and stock updated successfully');
    }
    catch (err) {
        next(err);
    }
};
exports.receivePurchaseOrderItems = receivePurchaseOrderItems;
// ==========================================
// 12. CSV EXPORTS (STREAMING)
// ==========================================
const exportItemsCsv = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const items = await prisma_1.prisma.inventory_items.findMany({
            where: { schoolId },
            include: {
                category: { select: { name: true } },
                primaryLocation: { select: { name: true } },
                primarySupplier: { select: { name: true } },
            },
            orderBy: { name: 'asc' },
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory-items.csv"');
        res.write('SKU,Item Name,Category,Type,Current Stock,UoM,Min Stock,Unit Price,Location,Supplier,Status\n');
        for (const item of items) {
            const line = [
                escapeCsv(item.sku),
                escapeCsv(item.name),
                escapeCsv(item.category?.name || 'Unassigned'),
                escapeCsv(item.itemType),
                item.currentStock,
                escapeCsv(item.unitOfMeasurement),
                item.minStockThreshold,
                Number(item.purchasePrice || 0).toFixed(2),
                escapeCsv(item.primaryLocation?.name || 'N/A'),
                escapeCsv(item.primarySupplier?.name || 'N/A'),
                item.isActive ? 'Active' : 'Inactive',
            ].join(',');
            res.write(line + '\n');
        }
        res.end();
    }
    catch (err) {
        next(err);
    }
};
exports.exportItemsCsv = exportItemsCsv;
const exportStockMovementsCsv = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const movements = await prisma_1.prisma.inventory_stock_movements.findMany({
            where: { schoolId },
            include: {
                item: { select: { sku: true, name: true, unitOfMeasurement: true } },
                performedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 2000,
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="stock-movements.csv"');
        res.write('Date,Item SKU,Item Name,Movement Type,Quantity,Previous Stock,New Stock,Unit Price,Reference,Reason,Performed By\n');
        for (const m of movements) {
            const line = [
                escapeCsv(m.createdAt.toISOString()),
                escapeCsv(m.item?.sku),
                escapeCsv(m.item?.name),
                escapeCsv(m.movementType),
                m.quantity,
                m.previousQuantity,
                m.newQuantity,
                Number(m.unitPrice || 0).toFixed(2),
                escapeCsv(m.referenceNumber || ''),
                escapeCsv(m.reason || ''),
                escapeCsv(m.performedBy ? m.performedBy.name : 'System'),
            ].join(',');
            res.write(line + '\n');
        }
        res.end();
    }
    catch (err) {
        next(err);
    }
};
exports.exportStockMovementsCsv = exportStockMovementsCsv;
const exportAssetsCsv = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const assets = await prisma_1.prisma.inventory_assets.findMany({
            where: { schoolId },
            include: {
                location: { select: { name: true } },
                supplier: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="assets-register.csv"');
        res.write('Asset Number,Asset Name,Serial Number,Brand,Department,Location,Status,Condition,Purchase Date,Purchase Price,Current Book Value,Accumulated Depreciation\n');
        for (const a of assets) {
            const line = [
                escapeCsv(a.assetNumber),
                escapeCsv(a.name),
                escapeCsv(a.serialNumber || ''),
                escapeCsv(a.brand || ''),
                escapeCsv(a.department || ''),
                escapeCsv(a.location?.name || 'N/A'),
                escapeCsv(a.status),
                escapeCsv(a.condition),
                escapeCsv(a.purchaseDate.toISOString().split('T')[0]),
                Number(a.purchasePrice || 0).toFixed(2),
                Number(a.currentBookValue || 0).toFixed(2),
                Number(a.accumulatedDepreciation || 0).toFixed(2),
            ].join(',');
            res.write(line + '\n');
        }
        res.end();
    }
    catch (err) {
        next(err);
    }
};
exports.exportAssetsCsv = exportAssetsCsv;
const exportDepreciationCsv = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const records = await prisma_1.prisma.inventory_depreciations.findMany({
            where: { schoolId },
            include: {
                asset: { select: { assetNumber: true, name: true } },
            },
            orderBy: { periodEndDate: 'desc' },
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="depreciation-schedule.csv"');
        res.write('Fiscal Year,Asset Number,Asset Name,Method,Period Start,Period End,Opening Book Value,Depreciation Amount,Closing Book Value,Rate %\n');
        for (const r of records) {
            const line = [
                escapeCsv(r.fiscalYear),
                escapeCsv(r.asset.assetNumber),
                escapeCsv(r.asset.name),
                escapeCsv(r.depreciationMethod),
                escapeCsv(r.periodStartDate.toISOString().split('T')[0]),
                escapeCsv(r.periodEndDate.toISOString().split('T')[0]),
                Number(r.openingBookValue || 0).toFixed(2),
                Number(r.depreciationAmount || 0).toFixed(2),
                Number(r.closingBookValue || 0).toFixed(2),
                r.ratePercentage ? `${r.ratePercentage}%` : 'N/A',
            ].join(',');
            res.write(line + '\n');
        }
        res.end();
    }
    catch (err) {
        next(err);
    }
};
exports.exportDepreciationCsv = exportDepreciationCsv;
const exportMaintenanceCsv = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const tickets = await prisma_1.prisma.inventory_maintenance_tickets.findMany({
            where: { schoolId },
            include: {
                asset: { select: { assetNumber: true, name: true } },
                supplier: { select: { name: true } },
            },
            orderBy: { openedAt: 'desc' },
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="maintenance-log.csv"');
        res.write('Ticket Number,Asset Number,Asset Name,Title,Priority,Status,Estimated Cost,Actual Cost,Opened Date,Resolved Date,Assigned Staff\n');
        for (const t of tickets) {
            const line = [
                escapeCsv(t.ticketNumber),
                escapeCsv(t.asset.assetNumber),
                escapeCsv(t.asset.name),
                escapeCsv(t.title),
                escapeCsv(t.priority),
                escapeCsv(t.status),
                Number(t.estimatedCost || 0).toFixed(2),
                Number(t.actualCost || 0).toFixed(2),
                escapeCsv(t.openedAt.toISOString().split('T')[0]),
                escapeCsv(t.resolvedAt ? t.resolvedAt.toISOString().split('T')[0] : 'Open'),
                escapeCsv(t.assignedStaffId || 'Unassigned'),
            ].join(',');
            res.write(line + '\n');
        }
        res.end();
    }
    catch (err) {
        next(err);
    }
};
exports.exportMaintenanceCsv = exportMaintenanceCsv;
