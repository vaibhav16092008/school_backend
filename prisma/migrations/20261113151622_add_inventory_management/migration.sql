-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('CONSUMABLE', 'ASSET');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('INWARD', 'OUTWARD', 'ADJUSTMENT', 'TRANSFER', 'DAMAGED', 'EXPIRED', 'RETURN');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'DAMAGED', 'DISPOSED', 'LOST');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'WRITTEN_DOWN_VALUE');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_locations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "roomNumber" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_suppliers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactPerson" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "primaryLocationId" TEXT,
    "primarySupplierId" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "brand" TEXT,
    "modelNumber" TEXT,
    "unitOfMeasurement" TEXT NOT NULL DEFAULT 'PCS',
    "itemType" "InventoryItemType" NOT NULL DEFAULT 'CONSUMABLE',
    "purchasePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "purchaseDate" TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_movements" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "newQuantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "referenceNumber" TEXT,
    "batchNumber" TEXT,
    "reason" TEXT,
    "sourceLocationId" TEXT,
    "targetLocationId" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stock_transfers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "targetLocationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_assets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "itemId" TEXT,
    "supplierId" TEXT,
    "locationId" TEXT,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "brand" TEXT,
    "modelNumber" TEXT,
    "department" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "warrantyExpiry" TIMESTAMP(3),
    "warrantyDetails" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'NEW',
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "usefulLifeMonths" INTEGER NOT NULL DEFAULT 36,
    "salvageValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "currentBookValue" DECIMAL(12,2) NOT NULL,
    "accumulatedDepreciation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastDepreciationDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_asset_assignments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "teacherId" TEXT,
    "userId" TEXT,
    "department" TEXT,
    "locationId" TEXT,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnDate" TIMESTAMP(3),
    "expectedReturnDate" TIMESTAMP(3),
    "assignedCondition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "returnCondition" "AssetCondition",
    "isReturned" BOOLEAN NOT NULL DEFAULT false,
    "assignmentRemarks" TEXT,
    "returnRemarks" TEXT,
    "assignedById" TEXT,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_asset_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_depreciations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL,
    "openingBookValue" DECIMAL(12,2) NOT NULL,
    "depreciationAmount" DECIMAL(12,2) NOT NULL,
    "closingBookValue" DECIMAL(12,2) NOT NULL,
    "ratePercentage" DECIMAL(5,2),
    "calculationRemarks" TEXT,
    "calculatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_depreciations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_maintenance_tickets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "supplierId" TEXT,
    "reportedById" TEXT,
    "assignedStaffId" TEXT,
    "title" TEXT NOT NULL,
    "issueDescription" TEXT NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "actualCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "workNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_maintenance_logs" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "previousStatus" "MaintenanceStatus",
    "newStatus" "MaintenanceStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "actionCost" DECIMAL(12,2),
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_maintenance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchase_orders" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "orderedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_categories_schoolId_idx" ON "inventory_categories"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_schoolId_code_key" ON "inventory_categories"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_schoolId_name_key" ON "inventory_categories"("schoolId", "name");

-- CreateIndex
CREATE INDEX "inventory_locations_schoolId_idx" ON "inventory_locations"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_locations_schoolId_code_key" ON "inventory_locations"("schoolId", "code");

-- CreateIndex
CREATE INDEX "inventory_suppliers_schoolId_idx" ON "inventory_suppliers"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_suppliers_schoolId_name_key" ON "inventory_suppliers"("schoolId", "name");

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_categoryId_idx" ON "inventory_items"("schoolId", "categoryId");

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_itemType_idx" ON "inventory_items"("schoolId", "itemType");

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_currentStock_idx" ON "inventory_items"("schoolId", "currentStock");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_schoolId_sku_key" ON "inventory_items"("schoolId", "sku");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_schoolId_itemId_idx" ON "inventory_stock_movements"("schoolId", "itemId");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_schoolId_movementType_idx" ON "inventory_stock_movements"("schoolId", "movementType");

-- CreateIndex
CREATE INDEX "inventory_stock_movements_schoolId_createdAt_idx" ON "inventory_stock_movements"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_stock_transfers_schoolId_idx" ON "inventory_stock_transfers"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stock_transfers_schoolId_transferNumber_key" ON "inventory_stock_transfers"("schoolId", "transferNumber");

-- CreateIndex
CREATE INDEX "inventory_assets_schoolId_status_idx" ON "inventory_assets"("schoolId", "status");

-- CreateIndex
CREATE INDEX "inventory_assets_schoolId_condition_idx" ON "inventory_assets"("schoolId", "condition");

-- CreateIndex
CREATE INDEX "inventory_assets_schoolId_locationId_idx" ON "inventory_assets"("schoolId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_assets_schoolId_assetNumber_key" ON "inventory_assets"("schoolId", "assetNumber");

-- CreateIndex
CREATE INDEX "inventory_asset_assignments_schoolId_assetId_idx" ON "inventory_asset_assignments"("schoolId", "assetId");

-- CreateIndex
CREATE INDEX "inventory_asset_assignments_schoolId_isReturned_idx" ON "inventory_asset_assignments"("schoolId", "isReturned");

-- CreateIndex
CREATE INDEX "inventory_depreciations_schoolId_assetId_idx" ON "inventory_depreciations"("schoolId", "assetId");

-- CreateIndex
CREATE INDEX "inventory_depreciations_schoolId_fiscalYear_idx" ON "inventory_depreciations"("schoolId", "fiscalYear");

-- CreateIndex
CREATE INDEX "inventory_maintenance_tickets_schoolId_status_idx" ON "inventory_maintenance_tickets"("schoolId", "status");

-- CreateIndex
CREATE INDEX "inventory_maintenance_tickets_schoolId_priority_idx" ON "inventory_maintenance_tickets"("schoolId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_maintenance_tickets_schoolId_ticketNumber_key" ON "inventory_maintenance_tickets"("schoolId", "ticketNumber");

-- CreateIndex
CREATE INDEX "inventory_maintenance_logs_ticketId_idx" ON "inventory_maintenance_logs"("ticketId");

-- CreateIndex
CREATE INDEX "inventory_purchase_orders_schoolId_status_idx" ON "inventory_purchase_orders"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_purchase_orders_schoolId_poNumber_key" ON "inventory_purchase_orders"("schoolId", "poNumber");

-- CreateIndex
CREATE INDEX "inventory_purchase_order_items_purchaseOrderId_idx" ON "inventory_purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "inventory_purchase_order_items_itemId_idx" ON "inventory_purchase_order_items"("itemId");

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_locations" ADD CONSTRAINT "inventory_locations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_suppliers" ADD CONSTRAINT "inventory_suppliers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_primaryLocationId_fkey" FOREIGN KEY ("primaryLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_primarySupplierId_fkey" FOREIGN KEY ("primarySupplierId") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stock_transfers" ADD CONSTRAINT "inventory_stock_transfers_targetLocationId_fkey" FOREIGN KEY ("targetLocationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_assets" ADD CONSTRAINT "inventory_assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_asset_assignments" ADD CONSTRAINT "inventory_asset_assignments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_asset_assignments" ADD CONSTRAINT "inventory_asset_assignments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "inventory_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_asset_assignments" ADD CONSTRAINT "inventory_asset_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_asset_assignments" ADD CONSTRAINT "inventory_asset_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_depreciations" ADD CONSTRAINT "inventory_depreciations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_depreciations" ADD CONSTRAINT "inventory_depreciations_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "inventory_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_maintenance_tickets" ADD CONSTRAINT "inventory_maintenance_tickets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_maintenance_tickets" ADD CONSTRAINT "inventory_maintenance_tickets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "inventory_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_maintenance_tickets" ADD CONSTRAINT "inventory_maintenance_tickets_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "inventory_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_maintenance_logs" ADD CONSTRAINT "inventory_maintenance_logs_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "inventory_maintenance_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_orders" ADD CONSTRAINT "inventory_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "inventory_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "inventory_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_purchase_order_items" ADD CONSTRAINT "inventory_purchase_order_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
