"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receivePurchaseOrderItemsSchema = exports.updatePurchaseOrderStatusSchema = exports.createPurchaseOrderSchema = exports.runDepreciationSchema = exports.addMaintenanceLogSchema = exports.updateMaintenanceTicketSchema = exports.createMaintenanceTicketSchema = exports.returnAssetSchema = exports.assignAssetSchema = exports.updateAssetSchema = exports.createAssetSchema = exports.stockTransferSchema = exports.stockAdjustmentSchema = exports.stockOutwardSchema = exports.stockInwardSchema = exports.updateItemSchema = exports.createItemSchema = exports.updateSupplierSchema = exports.createSupplierSchema = exports.updateLocationSchema = exports.createLocationSchema = exports.updateCategorySchema = exports.createCategorySchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
// ==========================================
// 1. CATEGORY VALIDATORS
// ==========================================
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Category name is required').max(100),
    code: zod_1.z.string().max(50).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    code: zod_1.z.string().max(50).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 2. LOCATION VALIDATORS
// ==========================================
exports.createLocationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Location name is required').max(100),
    code: zod_1.z.string().max(50).optional().nullable(),
    building: zod_1.z.string().max(100).optional().nullable(),
    floor: zod_1.z.string().max(50).optional().nullable(),
    roomNumber: zod_1.z.string().max(50).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateLocationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    code: zod_1.z.string().max(50).optional().nullable(),
    building: zod_1.z.string().max(100).optional().nullable(),
    floor: zod_1.z.string().max(50).optional().nullable(),
    roomNumber: zod_1.z.string().max(50).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 3. SUPPLIER VALIDATORS
// ==========================================
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Supplier name is required').max(150),
    code: zod_1.z.string().max(50).optional().nullable(),
    contactPerson: zod_1.z.string().max(100).optional().nullable(),
    email: zod_1.z.string().email('Invalid email').optional().nullable().or(zod_1.z.literal('')),
    phone: zod_1.z.string().max(30).optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    gstin: zod_1.z.string().max(50).optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150).optional(),
    code: zod_1.z.string().max(50).optional().nullable(),
    contactPerson: zod_1.z.string().max(100).optional().nullable(),
    email: zod_1.z.string().email('Invalid email').optional().nullable().or(zod_1.z.literal('')),
    phone: zod_1.z.string().max(30).optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    gstin: zod_1.z.string().max(50).optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 4. ITEM CATALOGUE VALIDATORS
// ==========================================
exports.createItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Item name is required').max(200),
    sku: zod_1.z
        .string()
        .min(1, 'SKU is required')
        .max(100)
        .transform((val) => val.trim().toUpperCase()),
    categoryId: zod_1.z.string().min(1, 'Category is required'),
    itemType: zod_1.z.nativeEnum(prisma_1.InventoryItemType).default(prisma_1.InventoryItemType.CONSUMABLE),
    description: zod_1.z.string().optional().nullable(),
    brand: zod_1.z.string().max(100).optional().nullable(),
    modelNumber: zod_1.z.string().max(100).optional().nullable(),
    unitOfMeasurement: zod_1.z.string().min(1, 'Unit of measure is required').max(50).default('PCS'),
    purchasePrice: zod_1.z.coerce.number().min(0).default(0),
    minStockThreshold: zod_1.z.coerce.number().int().min(0).default(5),
    primaryLocationId: zod_1.z.string().optional().nullable(),
    primarySupplierId: zod_1.z.string().optional().nullable(),
    initialStock: zod_1.z.coerce.number().int().min(0).default(0),
    purchaseDate: zod_1.z.coerce.date().optional().nullable(),
    warrantyExpiry: zod_1.z.coerce.date().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    sku: zod_1.z
        .string()
        .min(1)
        .max(100)
        .transform((val) => val.trim().toUpperCase())
        .optional(),
    categoryId: zod_1.z.string().min(1).optional(),
    itemType: zod_1.z.nativeEnum(prisma_1.InventoryItemType).optional(),
    description: zod_1.z.string().optional().nullable(),
    brand: zod_1.z.string().max(100).optional().nullable(),
    modelNumber: zod_1.z.string().max(100).optional().nullable(),
    unitOfMeasurement: zod_1.z.string().min(1).max(50).optional(),
    purchasePrice: zod_1.z.coerce.number().min(0).optional(),
    minStockThreshold: zod_1.z.coerce.number().int().min(0).optional(),
    primaryLocationId: zod_1.z.string().optional().nullable(),
    primarySupplierId: zod_1.z.string().optional().nullable(),
    purchaseDate: zod_1.z.coerce.date().optional().nullable(),
    warrantyExpiry: zod_1.z.coerce.date().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 5. STOCK MOVEMENT VALIDATORS
// ==========================================
exports.stockInwardSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1, 'Item is required'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    unitPrice: zod_1.z.coerce.number().min(0).optional().nullable(),
    supplierId: zod_1.z.string().optional().nullable(),
    targetLocationId: zod_1.z.string().optional().nullable(),
    referenceNumber: zod_1.z.string().max(100).optional().nullable(),
    batchNumber: zod_1.z.string().max(100).optional().nullable(),
    reason: zod_1.z.string().optional().nullable(),
});
exports.stockOutwardSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1, 'Item is required'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    sourceLocationId: zod_1.z.string().optional().nullable(),
    referenceNumber: zod_1.z.string().max(100).optional().nullable(),
    reason: zod_1.z.string().optional().nullable(),
});
exports.stockAdjustmentSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1, 'Item is required'),
    countedQuantity: zod_1.z.coerce.number().int().min(0, 'Counted quantity must be non-negative'),
    reason: zod_1.z.string().min(1, 'Adjustment reason is required').max(200),
    referenceNumber: zod_1.z.string().max(100).optional().nullable(),
});
exports.stockTransferSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1, 'Item is required'),
    sourceLocationId: zod_1.z.string().min(1, 'Source location is required'),
    targetLocationId: zod_1.z.string().min(1, 'Destination location is required'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    notes: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 6. ASSET REGISTER VALIDATORS
// ==========================================
exports.createAssetSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Asset name is required').max(200),
    assetNumber: zod_1.z.string().max(100).optional().nullable(),
    serialNumber: zod_1.z.string().max(100).optional().nullable(),
    brand: zod_1.z.string().max(100).optional().nullable(),
    modelNumber: zod_1.z.string().max(100).optional().nullable(),
    department: zod_1.z.string().max(100).optional().nullable(),
    itemId: zod_1.z.string().optional().nullable(),
    supplierId: zod_1.z.string().optional().nullable(),
    locationId: zod_1.z.string().optional().nullable(),
    purchaseDate: zod_1.z.coerce.date().default(() => new Date()),
    purchasePrice: zod_1.z.coerce.number().min(0, 'Purchase price must be non-negative'),
    salvageValue: zod_1.z.coerce.number().min(0).default(0),
    usefulLifeMonths: zod_1.z.coerce.number().int().min(1).default(36),
    depreciationMethod: zod_1.z.nativeEnum(prisma_1.DepreciationMethod).default(prisma_1.DepreciationMethod.STRAIGHT_LINE),
    warrantyExpiry: zod_1.z.coerce.date().optional().nullable(),
    warrantyDetails: zod_1.z.string().optional().nullable(),
    condition: zod_1.z.nativeEnum(prisma_1.AssetCondition).default(prisma_1.AssetCondition.NEW),
    status: zod_1.z.nativeEnum(prisma_1.AssetStatus).default(prisma_1.AssetStatus.AVAILABLE),
    notes: zod_1.z.string().optional().nullable(),
});
exports.updateAssetSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    serialNumber: zod_1.z.string().max(100).optional().nullable(),
    brand: zod_1.z.string().max(100).optional().nullable(),
    modelNumber: zod_1.z.string().max(100).optional().nullable(),
    department: zod_1.z.string().max(100).optional().nullable(),
    itemId: zod_1.z.string().optional().nullable(),
    supplierId: zod_1.z.string().optional().nullable(),
    locationId: zod_1.z.string().optional().nullable(),
    purchaseDate: zod_1.z.coerce.date().optional(),
    purchasePrice: zod_1.z.coerce.number().min(0).optional(),
    salvageValue: zod_1.z.coerce.number().min(0).optional(),
    usefulLifeMonths: zod_1.z.coerce.number().int().min(1).optional(),
    depreciationMethod: zod_1.z.nativeEnum(prisma_1.DepreciationMethod).optional(),
    warrantyExpiry: zod_1.z.coerce.date().optional().nullable(),
    warrantyDetails: zod_1.z.string().optional().nullable(),
    condition: zod_1.z.nativeEnum(prisma_1.AssetCondition).optional(),
    status: zod_1.z.nativeEnum(prisma_1.AssetStatus).optional(),
    notes: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 7. ASSET ASSIGNMENT & RETURN VALIDATORS
// ==========================================
exports.assignAssetSchema = zod_1.z.object({
    assetId: zod_1.z.string().optional().nullable(),
    userId: zod_1.z.string().optional().nullable(),
    teacherId: zod_1.z.string().optional().nullable(),
    department: zod_1.z.string().max(100).optional().nullable(),
    locationId: zod_1.z.string().optional().nullable(),
    assignedDate: zod_1.z.coerce.date().default(() => new Date()),
    expectedReturnDate: zod_1.z.coerce.date().optional().nullable(),
    assignedCondition: zod_1.z.nativeEnum(prisma_1.AssetCondition).default(prisma_1.AssetCondition.GOOD),
    assignmentRemarks: zod_1.z.string().optional().nullable(),
});
exports.returnAssetSchema = zod_1.z.object({
    returnCondition: zod_1.z.nativeEnum(prisma_1.AssetCondition).default(prisma_1.AssetCondition.GOOD),
    returnDate: zod_1.z.coerce.date().default(() => new Date()),
    locationId: zod_1.z.string().optional().nullable(),
    returnRemarks: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 8. ASSET MAINTENANCE VALIDATORS
// ==========================================
exports.createMaintenanceTicketSchema = zod_1.z.object({
    assetId: zod_1.z.string().min(1, 'Asset ID is required'),
    title: zod_1.z.string().min(1, 'Maintenance title is required').max(200),
    issueDescription: zod_1.z.string().min(1, 'Issue description is required'),
    priority: zod_1.z.nativeEnum(prisma_1.MaintenancePriority).default(prisma_1.MaintenancePriority.MEDIUM),
    assignedStaffId: zod_1.z.string().max(100).optional().nullable(),
    supplierId: zod_1.z.string().optional().nullable(),
    estimatedCost: zod_1.z.coerce.number().min(0).default(0),
    workNotes: zod_1.z.string().optional().nullable(),
});
exports.updateMaintenanceTicketSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    issueDescription: zod_1.z.string().min(1).optional(),
    status: zod_1.z.nativeEnum(prisma_1.MaintenanceStatus).optional(),
    priority: zod_1.z.nativeEnum(prisma_1.MaintenancePriority).optional(),
    assignedStaffId: zod_1.z.string().max(100).optional().nullable(),
    supplierId: zod_1.z.string().optional().nullable(),
    actualCost: zod_1.z.coerce.number().min(0).optional(),
    resolvedAt: zod_1.z.coerce.date().optional().nullable(),
    closedAt: zod_1.z.coerce.date().optional().nullable(),
    workNotes: zod_1.z.string().optional().nullable(),
});
exports.addMaintenanceLogSchema = zod_1.z.object({
    newStatus: zod_1.z.nativeEnum(prisma_1.MaintenanceStatus),
    note: zod_1.z.string().min(1, 'Log note is required'),
    actionCost: zod_1.z.coerce.number().min(0).optional().nullable(),
});
// ==========================================
// 9. DEPRECIATION RUN VALIDATOR
// ==========================================
exports.runDepreciationSchema = zod_1.z.object({
    fiscalYear: zod_1.z.string().min(1, 'Fiscal year is required (e.g. 2025-2026)'),
    periodStartDate: zod_1.z.coerce.date(),
    periodEndDate: zod_1.z.coerce.date(),
    assetIds: zod_1.z.array(zod_1.z.string()).optional(),
    remarks: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 10. PURCHASE ORDER VALIDATORS
// ==========================================
const poItemSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1, 'Item ID is required'),
    orderedQuantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    unitPrice: zod_1.z.coerce.number().min(0, 'Unit price must be non-negative'),
    taxRate: zod_1.z.coerce.number().min(0).max(100).default(0),
});
exports.createPurchaseOrderSchema = zod_1.z.object({
    supplierId: zod_1.z.string().min(1, 'Supplier is required'),
    poNumber: zod_1.z.string().max(50).optional().nullable(),
    orderDate: zod_1.z.coerce.date().default(() => new Date()),
    expectedDeliveryDate: zod_1.z.coerce.date().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    items: zod_1.z.array(poItemSchema).min(1, 'At least one item is required in the PO'),
});
exports.updatePurchaseOrderStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(prisma_1.PurchaseOrderStatus),
    notes: zod_1.z.string().optional().nullable(),
});
exports.receivePurchaseOrderItemsSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        poItemId: zod_1.z.string().min(1, 'PO Item ID is required'),
        receivedQuantity: zod_1.z.coerce.number().int().min(1, 'Received quantity must be at least 1'),
        targetLocationId: zod_1.z.string().optional().nullable(),
    }))
        .min(1, 'At least one item must be received'),
    notes: zod_1.z.string().optional().nullable(),
});
