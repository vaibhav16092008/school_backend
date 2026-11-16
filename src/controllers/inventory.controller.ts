import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  InventoryItemType,
  StockMovementType,
  AssetCondition,
  AssetStatus,
  DepreciationMethod,
  MaintenancePriority,
  MaintenanceStatus,
  PurchaseOrderStatus,
  TransferStatus,
  Prisma,
} from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// Helper: Escape CSV fields
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

// Helper: Generate Random Code suffix
function generateCode(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${ts}-${rand}`;
}

// ==========================================
// 1. INVENTORY DASHBOARD & KPIS
// ==========================================
export const getInventoryDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const [
      totalItems,
      consumablesCount,
      assetsCatalogueCount,
      totalAssetsRegistered,
      totalMaintenanceOpen,
      pendingPOs,
      allAssets,
      lowStockItems,
      recentMovements,
    ] = await Promise.all([
      prisma.inventory_items.count({ where: { schoolId, isActive: true } }),
      prisma.inventory_items.count({
        where: { schoolId, isActive: true, itemType: InventoryItemType.CONSUMABLE },
      }),
      prisma.inventory_items.count({
        where: { schoolId, isActive: true, itemType: InventoryItemType.ASSET },
      }),
      prisma.inventory_assets.count({ where: { schoolId } }),
      prisma.inventory_maintenance_tickets.count({
        where: {
          schoolId,
          status: { in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.ON_HOLD] },
        },
      }),
      prisma.inventory_purchase_orders.count({
        where: {
          schoolId,
          status: { in: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIALLY_RECEIVED] },
        },
      }),
      prisma.inventory_assets.findMany({
        where: { schoolId },
        select: { currentBookValue: true, purchasePrice: true, status: true },
      }),
      prisma.inventory_items.findMany({
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
      prisma.inventory_stock_movements.findMany({
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
    const totalAssetValuation = allAssets.reduce(
      (sum, a) => sum + Number(a.currentBookValue || 0),
      0
    );
    const totalPurchaseValuation = allAssets.reduce(
      (sum, a) => sum + Number(a.purchasePrice || 0),
      0
    );

    // Filter items where currentStock <= minStockThreshold
    const realLowStockItems = lowStockItems.filter(
      (i) => i.currentStock <= i.minStockThreshold
    );

    return sendSuccess(
      res,
      {
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
      },
      'Inventory dashboard fetched successfully'
    );
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. CATEGORIES CONTROLLERS
// ==========================================
export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const search = req.query.search as string | undefined;

    const where: Prisma.inventory_categoriesWhereInput = { schoolId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const categories = await prisma.inventory_categories.findMany({
      where,
      include: {
        _count: { select: { items: true } },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, categories, 'Categories retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { name, description, isActive } = req.body;
    let code = req.body.code ? String(req.body.code).trim().toUpperCase() : '';

    if (!code) {
      code = name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .slice(0, 20);
    }

    const existing = await prisma.inventory_categories.findFirst({
      where: {
        schoolId,
        OR: [{ name: { equals: name, mode: 'insensitive' } }, { code }],
      },
    });

    if (existing) {
      throw new ApiError(409, 'A category with this name or code already exists in your school');
    }

    const category = await prisma.inventory_categories.create({
      data: {
        schoolId,
        name,
        code,
        description,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'CREATE_INVENTORY_CATEGORY',
      resource: 'inventory_categories',
      resourceId: category.id,
      details: { name, code },
      req,
    });

    return sendSuccess(res, category, 'Category created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const category = await prisma.inventory_categories.findFirst({
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
      throw new ApiError(404, 'Category not found');
    }

    return sendSuccess(res, category, 'Category retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;
    const { name, code, description, isActive } = req.body;

    const category = await prisma.inventory_categories.findFirst({
      where: { id, schoolId },
    });

    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    const updated = await prisma.inventory_categories.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code: String(code).trim().toUpperCase() }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'UPDATE_INVENTORY_CATEGORY',
      resource: 'inventory_categories',
      resourceId: updated.id,
      details: req.body,
      req,
    });

    return sendSuccess(res, updated, 'Category updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const category = await prisma.inventory_categories.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { items: true } } },
    });

    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    if (category._count.items > 0) {
      throw new ApiError(400, 'Cannot delete category that contains items. Reassign or delete items first.');
    }

    await prisma.inventory_categories.delete({ where: { id } });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DELETE_INVENTORY_CATEGORY',
      resource: 'inventory_categories',
      resourceId: id,
      req,
    });

    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. LOCATIONS CONTROLLERS
// ==========================================
export const listLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const search = req.query.search as string | undefined;

    const where: Prisma.inventory_locationsWhereInput = { schoolId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { building: { contains: search, mode: 'insensitive' } },
      ];
    }

    const locations = await prisma.inventory_locations.findMany({
      where,
      include: {
        _count: { select: { items: true, assets: true } },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, locations, 'Locations retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { name, building, floor, roomNumber, description, isActive } = req.body;
    let code = req.body.code ? String(req.body.code).trim().toUpperCase() : '';

    if (!code) {
      code = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 20);
    }

    const existing = await prisma.inventory_locations.findFirst({
      where: { schoolId, code },
    });

    if (existing) {
      throw new ApiError(409, 'A location with this code already exists in your school');
    }

    const location = await prisma.inventory_locations.create({
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'CREATE_INVENTORY_LOCATION',
      resource: 'inventory_locations',
      resourceId: location.id,
      details: { name, code },
      req,
    });

    return sendSuccess(res, location, 'Location created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const location = await prisma.inventory_locations.findFirst({
      where: { id, schoolId },
    });

    if (!location) {
      throw new ApiError(404, 'Location not found');
    }

    const updated = await prisma.inventory_locations.update({
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

    return sendSuccess(res, updated, 'Location updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const location = await prisma.inventory_locations.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { items: true, assets: true } } },
    });

    if (!location) {
      throw new ApiError(404, 'Location not found');
    }

    if (location._count.items > 0 || location._count.assets > 0) {
      throw new ApiError(400, 'Cannot delete location with linked items or assets');
    }

    await prisma.inventory_locations.delete({ where: { id } });

    return sendSuccess(res, null, 'Location deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. SUPPLIERS CONTROLLERS
// ==========================================
export const listSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const search = req.query.search as string | undefined;

    const where: Prisma.inventory_suppliersWhereInput = { schoolId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.inventory_suppliers.findMany({
      where,
      include: {
        _count: { select: { items: true, assets: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, suppliers, 'Suppliers retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { name, code, contactPerson, email, phone, address, gstin, notes, isActive } = req.body;

    const existing = await prisma.inventory_suppliers.findFirst({
      where: { schoolId, name: { equals: name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ApiError(409, 'A supplier with this name already exists in your school');
    }

    const supplier = await prisma.inventory_suppliers.create({
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'CREATE_INVENTORY_SUPPLIER',
      resource: 'inventory_suppliers',
      resourceId: supplier.id,
      details: { name },
      req,
    });

    return sendSuccess(res, supplier, 'Supplier created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const supplier = await prisma.inventory_suppliers.findFirst({
      where: { id, schoolId },
    });

    if (!supplier) {
      throw new ApiError(404, 'Supplier not found');
    }

    const updated = await prisma.inventory_suppliers.update({
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

    return sendSuccess(res, updated, 'Supplier updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const supplier = await prisma.inventory_suppliers.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { items: true, assets: true, purchaseOrders: true } },
      },
    });

    if (!supplier) {
      throw new ApiError(404, 'Supplier not found');
    }

    if (supplier._count.items > 0 || supplier._count.assets > 0 || supplier._count.purchaseOrders > 0) {
      throw new ApiError(400, 'Cannot delete supplier with linked items, assets, or purchase orders');
    }

    await prisma.inventory_suppliers.delete({ where: { id } });

    return sendSuccess(res, null, 'Supplier deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. ITEM CATALOGUE CONTROLLERS
// ==========================================
export const listItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      search,
      categoryId,
      itemType,
      lowStock,
      page = '1',
      limit = '20',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_itemsWhereInput = { schoolId };

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

    if (itemType && Object.values(InventoryItemType).includes(itemType as InventoryItemType)) {
      where.itemType = itemType as InventoryItemType;
    }

    const [total, items] = await Promise.all([
      prisma.inventory_items.count({ where }),
      prisma.inventory_items.findMany({
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

    return sendSuccess(
      res,
      {
        items: finalItems,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Inventory items retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const {
      name,
      sku,
      categoryId,
      itemType,
      description,
      brand,
      modelNumber,
      unitOfMeasurement,
      purchasePrice,
      minStockThreshold,
      primaryLocationId,
      primarySupplierId,
      initialStock = 0,
      purchaseDate,
      warrantyExpiry,
      isActive,
    } = req.body;

    const category = await prisma.inventory_categories.findFirst({
      where: { id: categoryId, schoolId },
    });
    if (!category) {
      throw new ApiError(404, 'Category not found in your school');
    }

    const existingSku = await prisma.inventory_items.findFirst({
      where: { schoolId, sku },
    });
    if (existingSku) {
      throw new ApiError(409, `An item with SKU "${sku}" already exists in your school`);
    }

    const item = await prisma.$transaction(async (tx) => {
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
          itemType: itemType || InventoryItemType.CONSUMABLE,
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
            movementType: StockMovementType.INWARD,
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

    await logAudit({
      schoolId,
      userId,
      action: 'CREATE_INVENTORY_ITEM',
      resource: 'inventory_items',
      resourceId: item.id,
      details: { sku, name, initialStock },
      req,
    });

    return sendSuccess(res, item, 'Item created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getItemById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const item = await prisma.inventory_items.findFirst({
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
      throw new ApiError(404, 'Item not found');
    }

    return sendSuccess(res, item, 'Item retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const item = await prisma.inventory_items.findFirst({
      where: { id, schoolId },
    });

    if (!item) {
      throw new ApiError(404, 'Item not found');
    }

    if (req.body.sku && req.body.sku !== item.sku) {
      const conflict = await prisma.inventory_items.findFirst({
        where: { schoolId, sku: req.body.sku },
      });
      if (conflict) {
        throw new ApiError(409, `An item with SKU "${req.body.sku}" already exists`);
      }
    }

    const updated = await prisma.inventory_items.update({
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

    return sendSuccess(res, updated, 'Item updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const item = await prisma.inventory_items.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { movements: true, assets: true, purchaseOrderItems: true } },
      },
    });

    if (!item) {
      throw new ApiError(404, 'Item not found');
    }

    if (item._count.movements > 0 || item._count.assets > 0 || item._count.purchaseOrderItems > 0) {
      await prisma.inventory_items.update({
        where: { id },
        data: { isActive: false },
      });
      return sendSuccess(res, null, 'Item has associated historical movements or assets and was deactivated instead of deleted');
    }

    await prisma.inventory_items.delete({ where: { id } });

    return sendSuccess(res, null, 'Item deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. STOCK MOVEMENTS (INWARD, OUTWARD, ADJUST, TRANSFER)
// ==========================================
export const recordStockInward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const { itemId, quantity, unitPrice, targetLocationId, referenceNumber, batchNumber, reason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventory_items.findFirst({
        where: { id: itemId, schoolId },
      });

      if (!item) {
        throw new ApiError(404, 'Item not found in your school');
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
          movementType: StockMovementType.INWARD,
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

    await logAudit({
      schoolId,
      userId,
      action: 'STOCK_INWARD',
      resource: 'inventory_stock_movements',
      resourceId: result.movement.id,
      details: { itemId, quantity, newStock: result.item.currentStock },
      req,
    });

    return sendSuccess(res, result, 'Stock inward recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const recordStockOutward = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const { itemId, quantity, sourceLocationId, referenceNumber, reason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventory_items.findFirst({
        where: { id: itemId, schoolId },
      });

      if (!item) {
        throw new ApiError(404, 'Item not found in your school');
      }

      if (item.currentStock < quantity) {
        throw new ApiError(
          400,
          `Insufficient stock. Available: ${item.currentStock} ${item.unitOfMeasurement}, requested: ${quantity} ${item.unitOfMeasurement}`
        );
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
          movementType: StockMovementType.OUTWARD,
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

    await logAudit({
      schoolId,
      userId,
      action: 'STOCK_OUTWARD',
      resource: 'inventory_stock_movements',
      resourceId: result.movement.id,
      details: { itemId, quantity, remainingStock: result.item.currentStock },
      req,
    });

    return sendSuccess(res, result, 'Stock outward recorded successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const recordStockAdjustment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const { itemId, countedQuantity, reason, referenceNumber } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventory_items.findFirst({
        where: { id: itemId, schoolId },
      });

      if (!item) {
        throw new ApiError(404, 'Item not found in your school');
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
          movementType: StockMovementType.ADJUSTMENT,
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

    await logAudit({
      schoolId,
      userId,
      action: 'STOCK_ADJUSTMENT',
      resource: 'inventory_stock_movements',
      resourceId: result.movement.id,
      details: { itemId, countedQuantity, adjustmentReason: reason },
      req,
    });

    return sendSuccess(res, result, 'Stock adjustment recorded successfully');
  } catch (err) {
    next(err);
  }
};

export const recordStockTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const { itemId, sourceLocationId, targetLocationId, quantity, notes } = req.body;

    if (sourceLocationId === targetLocationId) {
      throw new ApiError(400, 'Source and target location cannot be the same');
    }

    const [sourceLoc, targetLoc] = await Promise.all([
      prisma.inventory_locations.findFirst({ where: { id: sourceLocationId, schoolId } }),
      prisma.inventory_locations.findFirst({ where: { id: targetLocationId, schoolId } }),
    ]);

    if (!sourceLoc || !targetLoc) {
      throw new ApiError(404, 'Source or destination location not found');
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventory_items.findFirst({
        where: { id: itemId, schoolId },
      });

      if (!item) {
        throw new ApiError(404, 'Item not found in your school');
      }

      if (item.currentStock < quantity) {
        throw new ApiError(400, `Insufficient stock to transfer. Current stock: ${item.currentStock}`);
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
          status: TransferStatus.COMPLETED,
          notes,
          requestedById: userId || null,
          approvedById: userId || null,
        },
      });

      const movement = await tx.inventory_stock_movements.create({
        data: {
          schoolId,
          itemId,
          movementType: StockMovementType.TRANSFER,
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

    await logAudit({
      schoolId,
      userId,
      action: 'STOCK_TRANSFER',
      resource: 'inventory_stock_transfers',
      resourceId: result.transfer.id,
      details: { itemId, quantity, from: sourceLoc.name, to: targetLoc.name },
      req,
    });

    return sendSuccess(res, result, 'Stock transfer completed successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const listStockMovements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      itemId,
      movementType,
      startDate,
      endDate,
      page = '1',
      limit = '30',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_stock_movementsWhereInput = { schoolId };

    if (itemId) {
      where.itemId = itemId;
    }

    if (movementType && Object.values(StockMovementType).includes(movementType as StockMovementType)) {
      where.movementType = movementType as StockMovementType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, movements] = await Promise.all([
      prisma.inventory_stock_movements.count({ where }),
      prisma.inventory_stock_movements.findMany({
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

    return sendSuccess(
      res,
      {
        movements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Stock movements retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. ASSET REGISTER CONTROLLERS
// ==========================================
export const listAssets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      search,
      status,
      condition,
      locationId,
      department,
      page = '1',
      limit = '20',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_assetsWhereInput = { schoolId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetNumber: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && Object.values(AssetStatus).includes(status as AssetStatus)) {
      where.status = status as AssetStatus;
    }

    if (condition && Object.values(AssetCondition).includes(condition as AssetCondition)) {
      where.condition = condition as AssetCondition;
    }

    if (locationId) {
      where.locationId = locationId;
    }

    if (department) {
      where.department = { contains: department, mode: 'insensitive' };
    }

    const [total, assets] = await Promise.all([
      prisma.inventory_assets.count({ where }),
      prisma.inventory_assets.findMany({
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

    return sendSuccess(
      res,
      {
        assets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Assets retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

export const createAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const {
      name,
      serialNumber,
      brand,
      modelNumber,
      department,
      itemId,
      supplierId,
      locationId,
      purchaseDate,
      purchasePrice,
      salvageValue = 0,
      usefulLifeMonths = 36,
      depreciationMethod = DepreciationMethod.STRAIGHT_LINE,
      warrantyExpiry,
      warrantyDetails,
      condition = AssetCondition.NEW,
      status = AssetStatus.AVAILABLE,
      notes,
    } = req.body;

    let assetNumber = req.body.assetNumber ? String(req.body.assetNumber).trim() : '';
    if (!assetNumber) {
      assetNumber = generateCode('AST');
    }

    const existing = await prisma.inventory_assets.findFirst({
      where: { schoolId, assetNumber },
    });
    if (existing) {
      throw new ApiError(409, `An asset with asset number "${assetNumber}" already exists in your school`);
    }

    const asset = await prisma.inventory_assets.create({
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

    await logAudit({
      schoolId,
      userId,
      action: 'CREATE_INVENTORY_ASSET',
      resource: 'inventory_assets',
      resourceId: asset.id,
      details: { assetNumber, name, purchasePrice },
      req,
    });

    return sendSuccess(res, asset, 'Asset registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getAssetById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const asset = await prisma.inventory_assets.findFirst({
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
      throw new ApiError(404, 'Asset not found');
    }

    return sendSuccess(res, asset, 'Asset details retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const asset = await prisma.inventory_assets.findFirst({
      where: { id, schoolId },
    });

    if (!asset) {
      throw new ApiError(404, 'Asset not found');
    }

    const updated = await prisma.inventory_assets.update({
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

    return sendSuccess(res, updated, 'Asset updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const asset = await prisma.inventory_assets.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { assignments: true, maintenanceTickets: true, depreciations: true } },
      },
    });

    if (!asset) {
      throw new ApiError(404, 'Asset not found');
    }

    if (
      asset._count.assignments > 0 ||
      asset._count.maintenanceTickets > 0 ||
      asset._count.depreciations > 0
    ) {
      await prisma.inventory_assets.update({
        where: { id },
        data: { status: AssetStatus.DISPOSED },
      });
      return sendSuccess(res, null, 'Asset has historical records; marked as DISPOSED instead of deleted');
    }

    await prisma.inventory_assets.delete({ where: { id } });

    return sendSuccess(res, null, 'Asset deleted successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 8. ASSET ASSIGNMENT & RETURN
// ==========================================
export const assignAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const assetId = req.params.id as string;
    const {
      teacherId,
      userId: targetUserId,
      department,
      locationId,
      assignedDate,
      expectedReturnDate,
      assignedCondition = AssetCondition.GOOD,
      assignmentRemarks,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventory_assets.findFirst({
        where: { id: assetId, schoolId },
      });

      if (!asset) {
        throw new ApiError(404, 'Asset not found');
      }

      if (asset.status !== AssetStatus.AVAILABLE) {
        throw new ApiError(400, `Cannot assign asset. Current asset status is ${asset.status}`);
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
          status: AssetStatus.ASSIGNED,
          condition: assignedCondition,
          ...(department && { department }),
        },
      });

      return { assignment, asset: updatedAsset };
    });

    await logAudit({
      schoolId,
      userId,
      action: 'ASSIGN_INVENTORY_ASSET',
      resource: 'inventory_asset_assignments',
      resourceId: result.assignment.id,
      details: { assetId, teacherId, department },
      req,
    });

    return sendSuccess(res, result, 'Asset assigned successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const returnAsset = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const assetId = req.params.id as string;
    const {
      returnCondition = AssetCondition.GOOD,
      returnDate,
      locationId,
      returnRemarks,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventory_assets.findFirst({
        where: { id: assetId, schoolId },
      });

      if (!asset) {
        throw new ApiError(404, 'Asset not found');
      }

      const activeAssignment = await tx.inventory_asset_assignments.findFirst({
        where: { assetId, schoolId, isReturned: false },
        orderBy: { assignedDate: 'desc' },
      });

      if (!activeAssignment) {
        throw new ApiError(400, 'No active unreturned assignment found for this asset');
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

      const nextStatus =
        returnCondition === AssetCondition.DAMAGED
          ? AssetStatus.DAMAGED
          : AssetStatus.AVAILABLE;

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

    await logAudit({
      schoolId,
      userId,
      action: 'RETURN_INVENTORY_ASSET',
      resource: 'inventory_asset_assignments',
      resourceId: result.assignment.id,
      details: { assetId, returnCondition },
      req,
    });

    return sendSuccess(res, result, 'Asset returned successfully');
  } catch (err) {
    next(err);
  }
};

export const listAssetAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      assetId,
      isReturned,
      page = '1',
      limit = '25',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_asset_assignmentsWhereInput = { schoolId };
    if (assetId) where.assetId = assetId;
    if (isReturned !== undefined) where.isReturned = isReturned === 'true';

    const [total, assignments] = await Promise.all([
      prisma.inventory_asset_assignments.count({ where }),
      prisma.inventory_asset_assignments.findMany({
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

    return sendSuccess(
      res,
      {
        assignments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Asset assignments retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 9. ASSET MAINTENANCE TICKETS
// ==========================================
export const listMaintenanceTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      assetId,
      status,
      priority,
      page = '1',
      limit = '20',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_maintenance_ticketsWhereInput = { schoolId };
    if (assetId) where.assetId = assetId;
    if (status && Object.values(MaintenanceStatus).includes(status as MaintenanceStatus)) {
      where.status = status as MaintenanceStatus;
    }
    if (priority && Object.values(MaintenancePriority).includes(priority as MaintenancePriority)) {
      where.priority = priority as MaintenancePriority;
    }

    const [total, tickets] = await Promise.all([
      prisma.inventory_maintenance_tickets.count({ where }),
      prisma.inventory_maintenance_tickets.findMany({
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

    return sendSuccess(
      res,
      {
        tickets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Maintenance tickets retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

export const createMaintenanceTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const {
      assetId,
      title,
      issueDescription,
      priority = MaintenancePriority.MEDIUM,
      assignedStaffId,
      supplierId,
      estimatedCost = 0,
      workNotes,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.inventory_assets.findFirst({
        where: { id: assetId, schoolId },
      });

      if (!asset) {
        throw new ApiError(404, 'Asset not found in your school');
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
          status: MaintenanceStatus.OPEN,
          estimatedCost,
          workNotes,
        },
      });

      await tx.inventory_assets.update({
        where: { id: assetId },
        data: { status: AssetStatus.UNDER_MAINTENANCE },
      });

      await tx.inventory_maintenance_logs.create({
        data: {
          ticketId: ticket.id,
          previousStatus: null,
          newStatus: MaintenanceStatus.OPEN,
          note: `Maintenance ticket logged: ${title}`,
          actionCost: estimatedCost,
          performedById: userId || null,
        },
      });

      return ticket;
    });

    await logAudit({
      schoolId,
      userId,
      action: 'CREATE_MAINTENANCE_TICKET',
      resource: 'inventory_maintenance_tickets',
      resourceId: result.id,
      details: { assetId, title, priority },
      req,
    });

    return sendSuccess(res, result, 'Maintenance ticket created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getMaintenanceTicketById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const ticket = await prisma.inventory_maintenance_tickets.findFirst({
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
      throw new ApiError(404, 'Maintenance ticket not found');
    }

    return sendSuccess(res, ticket, 'Maintenance ticket retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updateMaintenanceTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const id = req.params.id as string;
    const {
      title,
      issueDescription,
      status,
      priority,
      assignedStaffId,
      supplierId,
      actualCost,
      workNotes,
    } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.inventory_maintenance_tickets.findFirst({
        where: { id, schoolId },
      });

      if (!ticket) {
        throw new ApiError(404, 'Maintenance ticket not found');
      }

      const prevStatus = ticket.status;
      const isClosingOrResolving =
        status &&
        (status === MaintenanceStatus.RESOLVED || status === MaintenanceStatus.CLOSED);

      const resolvedAt = isClosingOrResolving && !ticket.resolvedAt ? new Date() : ticket.resolvedAt;
      const closedAt = status === MaintenanceStatus.CLOSED && !ticket.closedAt ? new Date() : ticket.closedAt;

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
          if (asset && asset.status === AssetStatus.UNDER_MAINTENANCE) {
            await tx.inventory_assets.update({
              where: { id: ticket.assetId },
              data: {
                status:
                  asset.condition === AssetCondition.DAMAGED
                    ? AssetStatus.DAMAGED
                    : AssetStatus.AVAILABLE,
              },
            });
          }
        }
      }

      return updated;
    });

    return sendSuccess(res, result, 'Maintenance ticket updated successfully');
  } catch (err) {
    next(err);
  }
};

export const addMaintenanceLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const ticketId = req.params.id as string;
    const { newStatus, note, actionCost = 0 } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const ticket = await tx.inventory_maintenance_tickets.findFirst({
        where: { id: ticketId, schoolId },
      });

      if (!ticket) {
        throw new ApiError(404, 'Maintenance ticket not found');
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

    return sendSuccess(res, result, 'Maintenance log added successfully', 201);
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 10. DEPRECIATION ENGINE
// ==========================================
export const runDepreciation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const { fiscalYear, periodStartDate, periodEndDate, assetIds, remarks } = req.body;

    const pStart = new Date(periodStartDate);
    const pEnd = new Date(periodEndDate);

    const where: Prisma.inventory_assetsWhereInput = {
      schoolId,
      status: { notIn: [AssetStatus.DISPOSED, AssetStatus.LOST] },
    };

    if (assetIds && assetIds.length > 0) {
      where.id = { in: assetIds };
    }

    const eligibleAssets = await prisma.inventory_assets.findMany({ where });

    if (eligibleAssets.length === 0) {
      return sendSuccess(
        res,
        {
          processedCount: 0,
          depreciations: [],
        },
        'No eligible assets found for depreciation run'
      );
    }

    const processedLogs: any[] = [];

    await prisma.$transaction(async (tx) => {
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
        let ratePercentage: number | null = null;

        if (asset.depreciationMethod === DepreciationMethod.STRAIGHT_LINE) {
          const annualDep = (purchasePrice - salvageValue) / usefulYears;
          ratePercentage = Number(((1 / usefulYears) * 100).toFixed(2));
          depreciationAmount = Math.min(annualDep, currentBookValue - salvageValue);
        } else if (asset.depreciationMethod === DepreciationMethod.WRITTEN_DOWN_VALUE) {
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
        const newAccumulated = Number(
          (Number(asset.accumulatedDepreciation || 0) + depreciationAmount).toFixed(2)
        );

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

    await logAudit({
      schoolId,
      userId,
      action: 'RUN_DEPRECIATION',
      resource: 'inventory_depreciations',
      details: { fiscalYear, processedAssets: processedLogs.length },
      req,
    });

    return sendSuccess(
      res,
      {
        processedCount: processedLogs.length,
        depreciations: processedLogs,
      },
      `Depreciation run processed for ${processedLogs.length} assets`
    );
  } catch (err) {
    next(err);
  }
};

export const listDepreciationHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      fiscalYear,
      assetId,
      page = '1',
      limit = '30',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_depreciationsWhereInput = { schoolId };
    if (fiscalYear) where.fiscalYear = fiscalYear;
    if (assetId) where.assetId = assetId;

    const [total, records] = await Promise.all([
      prisma.inventory_depreciations.count({ where }),
      prisma.inventory_depreciations.findMany({
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

    return sendSuccess(
      res,
      {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Depreciation history retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 11. PURCHASE ORDERS & RECEIVING
// ==========================================
export const listPurchaseOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      status,
      supplierId,
      page = '1',
      limit = '20',
    } = req.query as { [key: string]: string };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.inventory_purchase_ordersWhereInput = { schoolId };
    if (status && Object.values(PurchaseOrderStatus).includes(status as PurchaseOrderStatus)) {
      where.status = status as PurchaseOrderStatus;
    }
    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [total, purchaseOrders] = await Promise.all([
      prisma.inventory_purchase_orders.count({ where }),
      prisma.inventory_purchase_orders.findMany({
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

    return sendSuccess(
      res,
      {
        purchaseOrders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Purchase orders retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const { supplierId, orderDate, expectedDeliveryDate, notes, items } = req.body;

    const supplier = await prisma.inventory_suppliers.findFirst({
      where: { id: supplierId, schoolId },
    });
    if (!supplier) {
      throw new ApiError(404, 'Supplier not found in your school');
    }

    let poNumber = req.body.poNumber ? String(req.body.poNumber).trim() : '';
    if (!poNumber) {
      poNumber = generateCode('PO');
    }

    const itemIds = items.map((i: any) => i.itemId);
    const foundItems = await prisma.inventory_items.findMany({
      where: { id: { in: itemIds }, schoolId },
    });
    if (foundItems.length !== itemIds.length) {
      throw new ApiError(400, 'One or more items in the purchase order do not exist');
    }

    let subtotal = 0;
    let taxAmount = 0;

    const itemData = items.map((i: any) => {
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

    const purchaseOrder = await prisma.inventory_purchase_orders.create({
      data: {
        schoolId,
        poNumber,
        supplierId,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        subtotal,
        taxAmount,
        totalAmount,
        status: PurchaseOrderStatus.DRAFT,
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

    await logAudit({
      schoolId,
      userId,
      action: 'CREATE_PURCHASE_ORDER',
      resource: 'inventory_purchase_orders',
      resourceId: purchaseOrder.id,
      details: { poNumber, totalAmount, supplierId },
      req,
    });

    return sendSuccess(res, purchaseOrder, 'Purchase order created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;

    const po = await prisma.inventory_purchase_orders.findFirst({
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
      throw new ApiError(404, 'Purchase order not found');
    }

    return sendSuccess(res, po, 'Purchase order retrieved successfully');
  } catch (err) {
    next(err);
  }
};

export const updatePurchaseOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = req.params.id as string;
    const { status, notes } = req.body;

    const po = await prisma.inventory_purchase_orders.findFirst({
      where: { id, schoolId },
    });

    if (!po) {
      throw new ApiError(404, 'Purchase order not found');
    }

    const updated = await prisma.inventory_purchase_orders.update({
      where: { id },
      data: {
        status,
        ...(notes && { notes: po.notes ? `${po.notes}\n${notes}` : notes }),
      },
    });

    return sendSuccess(res, updated, `Purchase order status updated to ${status}`);
  } catch (err) {
    next(err);
  }
};

export const receivePurchaseOrderItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const userId = req.user?.id;
    const poId = req.params.id as string;
    const { items, notes } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.inventory_purchase_orders.findFirst({
        where: { id: poId, schoolId },
        include: { items: true },
      });

      if (!po) {
        throw new ApiError(404, 'Purchase order not found');
      }

      if (po.status === PurchaseOrderStatus.CANCELLED) {
        throw new ApiError(400, 'Cannot receive items against a CANCELLED purchase order');
      }

      for (const rec of items) {
        const poItem = po.items.find((i: any) => i.id === rec.poItemId);
        if (!poItem) {
          throw new ApiError(400, `PO Item ID ${rec.poItemId} not found on this purchase order`);
        }

        const newRecQty = poItem.receivedQuantity + rec.receivedQuantity;
        if (newRecQty > poItem.orderedQuantity) {
          throw new ApiError(
            400,
            `Cannot receive more than ordered quantity. Ordered: ${poItem.orderedQuantity}, previously received: ${poItem.receivedQuantity}, attempted: ${rec.receivedQuantity}`
          );
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
              movementType: StockMovementType.INWARD,
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

      const allFullyReceived = updatedPoItems.every(
        (i) => i.receivedQuantity >= i.orderedQuantity
      );
      const someReceived = updatedPoItems.some((i) => i.receivedQuantity > 0);

      const nextStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : someReceived
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
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

    await logAudit({
      schoolId,
      userId,
      action: 'RECEIVE_PO_ITEMS',
      resource: 'inventory_purchase_orders',
      resourceId: result.id,
      details: { poNumber: result.poNumber, status: result.status },
      req,
    });

    return sendSuccess(res, result, 'Purchase order items received and stock updated successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 12. CSV EXPORTS (STREAMING)
// ==========================================
export const exportItemsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;

    const items = await prisma.inventory_items.findMany({
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
  } catch (err) {
    next(err);
  }
};

export const exportStockMovementsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;

    const movements = await prisma.inventory_stock_movements.findMany({
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
  } catch (err) {
    next(err);
  }
};

export const exportAssetsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;

    const assets = await prisma.inventory_assets.findMany({
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
  } catch (err) {
    next(err);
  }
};

export const exportDepreciationCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;

    const records = await prisma.inventory_depreciations.findMany({
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
  } catch (err) {
    next(err);
  }
};

export const exportMaintenanceCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;

    const tickets = await prisma.inventory_maintenance_tickets.findMany({
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
  } catch (err) {
    next(err);
  }
};
