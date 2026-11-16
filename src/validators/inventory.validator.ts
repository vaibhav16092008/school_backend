import { z } from 'zod';
import {
  InventoryItemType,
  StockMovementType,
  AssetCondition,
  AssetStatus,
  DepreciationMethod,
  MaintenancePriority,
  MaintenanceStatus,
  PurchaseOrderStatus,
  TransferStatus,
} from '../lib/prisma';

// ==========================================
// 1. CATEGORY VALIDATORS
// ==========================================
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 2. LOCATION VALIDATORS
// ==========================================
export const createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(100),
  code: z.string().max(50).optional().nullable(),
  building: z.string().max(100).optional().nullable(),
  floor: z.string().max(50).optional().nullable(),
  roomNumber: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).optional().nullable(),
  building: z.string().max(100).optional().nullable(),
  floor: z.string().max(50).optional().nullable(),
  roomNumber: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 3. SUPPLIER VALIDATORS
// ==========================================
export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(150),
  code: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().optional().nullable(),
  gstin: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  code: z.string().max(50).optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().optional().nullable(),
  gstin: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 4. ITEM CATALOGUE VALIDATORS
// ==========================================
export const createItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100)
    .transform((val) => val.trim().toUpperCase()),
  categoryId: z.string().min(1, 'Category is required'),
  itemType: z.nativeEnum(InventoryItemType).default(InventoryItemType.CONSUMABLE),
  description: z.string().optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  modelNumber: z.string().max(100).optional().nullable(),
  unitOfMeasurement: z.string().min(1, 'Unit of measure is required').max(50).default('PCS'),
  purchasePrice: z.coerce.number().min(0).default(0),
  minStockThreshold: z.coerce.number().int().min(0).default(5),
  primaryLocationId: z.string().optional().nullable(),
  primarySupplierId: z.string().optional().nullable(),
  initialStock: z.coerce.number().int().min(0).default(0),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  categoryId: z.string().min(1).optional(),
  itemType: z.nativeEnum(InventoryItemType).optional(),
  description: z.string().optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  modelNumber: z.string().max(100).optional().nullable(),
  unitOfMeasurement: z.string().min(1).max(50).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  minStockThreshold: z.coerce.number().int().min(0).optional(),
  primaryLocationId: z.string().optional().nullable(),
  primarySupplierId: z.string().optional().nullable(),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 5. STOCK MOVEMENT VALIDATORS
// ==========================================
export const stockInwardSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  targetLocationId: z.string().optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
  batchNumber: z.string().max(100).optional().nullable(),
  reason: z.string().optional().nullable(),
});

export const stockOutwardSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  sourceLocationId: z.string().optional().nullable(),
  referenceNumber: z.string().max(100).optional().nullable(),
  reason: z.string().optional().nullable(),
});

export const stockAdjustmentSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  countedQuantity: z.coerce.number().int().min(0, 'Counted quantity must be non-negative'),
  reason: z.string().min(1, 'Adjustment reason is required').max(200),
  referenceNumber: z.string().max(100).optional().nullable(),
});

export const stockTransferSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  sourceLocationId: z.string().min(1, 'Source location is required'),
  targetLocationId: z.string().min(1, 'Destination location is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional().nullable(),
});

// ==========================================
// 6. ASSET REGISTER VALIDATORS
// ==========================================
export const createAssetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(200),
  assetNumber: z.string().max(100).optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  modelNumber: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  itemId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  purchaseDate: z.coerce.date().default(() => new Date()),
  purchasePrice: z.coerce.number().min(0, 'Purchase price must be non-negative'),
  salvageValue: z.coerce.number().min(0).default(0),
  usefulLifeMonths: z.coerce.number().int().min(1).default(36),
  depreciationMethod: z.nativeEnum(DepreciationMethod).default(DepreciationMethod.STRAIGHT_LINE),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  warrantyDetails: z.string().optional().nullable(),
  condition: z.nativeEnum(AssetCondition).default(AssetCondition.NEW),
  status: z.nativeEnum(AssetStatus).default(AssetStatus.AVAILABLE),
  notes: z.string().optional().nullable(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  serialNumber: z.string().max(100).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  modelNumber: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  itemId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  salvageValue: z.coerce.number().min(0).optional(),
  usefulLifeMonths: z.coerce.number().int().min(1).optional(),
  depreciationMethod: z.nativeEnum(DepreciationMethod).optional(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  warrantyDetails: z.string().optional().nullable(),
  condition: z.nativeEnum(AssetCondition).optional(),
  status: z.nativeEnum(AssetStatus).optional(),
  notes: z.string().optional().nullable(),
});

// ==========================================
// 7. ASSET ASSIGNMENT & RETURN VALIDATORS
// ==========================================
export const assignAssetSchema = z.object({
  assetId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  locationId: z.string().optional().nullable(),
  assignedDate: z.coerce.date().default(() => new Date()),
  expectedReturnDate: z.coerce.date().optional().nullable(),
  assignedCondition: z.nativeEnum(AssetCondition).default(AssetCondition.GOOD),
  assignmentRemarks: z.string().optional().nullable(),
});

export const returnAssetSchema = z.object({
  returnCondition: z.nativeEnum(AssetCondition).default(AssetCondition.GOOD),
  returnDate: z.coerce.date().default(() => new Date()),
  locationId: z.string().optional().nullable(),
  returnRemarks: z.string().optional().nullable(),
});

// ==========================================
// 8. ASSET MAINTENANCE VALIDATORS
// ==========================================
export const createMaintenanceTicketSchema = z.object({
  assetId: z.string().min(1, 'Asset ID is required'),
  title: z.string().min(1, 'Maintenance title is required').max(200),
  issueDescription: z.string().min(1, 'Issue description is required'),
  priority: z.nativeEnum(MaintenancePriority).default(MaintenancePriority.MEDIUM),
  assignedStaffId: z.string().max(100).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  estimatedCost: z.coerce.number().min(0).default(0),
  workNotes: z.string().optional().nullable(),
});

export const updateMaintenanceTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  issueDescription: z.string().min(1).optional(),
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  assignedStaffId: z.string().max(100).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  actualCost: z.coerce.number().min(0).optional(),
  resolvedAt: z.coerce.date().optional().nullable(),
  closedAt: z.coerce.date().optional().nullable(),
  workNotes: z.string().optional().nullable(),
});

export const addMaintenanceLogSchema = z.object({
  newStatus: z.nativeEnum(MaintenanceStatus),
  note: z.string().min(1, 'Log note is required'),
  actionCost: z.coerce.number().min(0).optional().nullable(),
});

// ==========================================
// 9. DEPRECIATION RUN VALIDATOR
// ==========================================
export const runDepreciationSchema = z.object({
  fiscalYear: z.string().min(1, 'Fiscal year is required (e.g. 2025-2026)'),
  periodStartDate: z.coerce.date(),
  periodEndDate: z.coerce.date(),
  assetIds: z.array(z.string()).optional(),
  remarks: z.string().optional().nullable(),
});

// ==========================================
// 10. PURCHASE ORDER VALIDATORS
// ==========================================
const poItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  orderedQuantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  poNumber: z.string().max(50).optional().nullable(),
  orderDate: z.coerce.date().default(() => new Date()),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(poItemSchema).min(1, 'At least one item is required in the PO'),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.nativeEnum(PurchaseOrderStatus),
  notes: z.string().optional().nullable(),
});

export const receivePurchaseOrderItemsSchema = z.object({
  items: z
    .array(
      z.object({
        poItemId: z.string().min(1, 'PO Item ID is required'),
        receivedQuantity: z.coerce.number().int().min(1, 'Received quantity must be at least 1'),
        targetLocationId: z.string().optional().nullable(),
      })
    )
    .min(1, 'At least one item must be received'),
  notes: z.string().optional().nullable(),
});
