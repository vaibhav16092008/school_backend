import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  VehicleStatus,
  RouteStatus,
  DriverStatus,
  AssignmentStatus,
  AllocationStatus,
  InvoiceStatus,
  Prisma,
} from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// Helper: Generate unique reference/document numbers
function generateDocumentNumber(prefix: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
}

// Helper: Escape CSV string value
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

// ==========================================
// 1. TRANSPORT DASHBOARD & ANALYTICS
// ==========================================

export const getTransportDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 1. Vehicle counts
    const [
      totalVehicles,
      activeVehicles,
      maintenanceVehicles,
      inactiveVehicles,
      totalRoutes,
      activeRoutes,
      totalDrivers,
      activeDrivers,
      totalStudents,
      activeAllocations,
    ] = await Promise.all([
      prisma.vehicles.count({ where: { schoolId } }),
      prisma.vehicles.count({ where: { schoolId, status: VehicleStatus.ACTIVE } }),
      prisma.vehicles.count({
        where: { schoolId, status: VehicleStatus.MAINTENANCE },
      }),
      prisma.vehicles.count({
        where: { schoolId, status: VehicleStatus.INACTIVE },
      }),
      prisma.transport_routes.count({ where: { schoolId } }),
      prisma.transport_routes.count({
        where: { schoolId, status: RouteStatus.ACTIVE },
      }),
      prisma.drivers.count({ where: { schoolId } }),
      prisma.drivers.count({ where: { schoolId, status: DriverStatus.ACTIVE } }),
      prisma.students.count({ where: { schoolId, status: 'ACTIVE' } }),
      prisma.student_transport_allocations.findMany({
        where: { schoolId, status: AllocationStatus.ACTIVE },
        select: { studentId: true, routeId: true, fare: true },
      }),
    ]);

    const allocatedStudentIds = new Set(activeAllocations.map((a) => a.studentId));
    const allocatedStudentsCount = allocatedStudentIds.size;
    const unallocatedStudentsCount = Math.max(0, totalStudents - allocatedStudentsCount);

    // 2. Expiring vehicle documents (< 30 days or already expired)
    const vehiclesWithExpiringDocs = await prisma.vehicles.findMany({
      where: {
        schoolId,
        status: { in: [VehicleStatus.ACTIVE, VehicleStatus.MAINTENANCE] },
        OR: [
          { insuranceExpiry: { lte: thirtyDaysFromNow } },
          { fitnessExpiry: { lte: thirtyDaysFromNow } },
          { permitExpiry: { lte: thirtyDaysFromNow } },
          { pollutionExpiry: { lte: thirtyDaysFromNow } },
        ],
      },
      select: {
        id: true,
        registrationNumber: true,
        name: true,
        type: true,
        status: true,
        insuranceExpiry: true,
        fitnessExpiry: true,
        permitExpiry: true,
        pollutionExpiry: true,
      },
      orderBy: { registrationNumber: 'asc' },
    });

    // 3. Expiring driver licenses (< 30 days or already expired)
    const expiringDriverLicenses = await prisma.drivers.findMany({
      where: {
        schoolId,
        status: DriverStatus.ACTIVE,
        licenseExpiry: { lte: thirtyDaysFromNow },
      },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        phone: true,
        licenseNumber: true,
        licenseExpiry: true,
      },
      orderBy: { licenseExpiry: 'asc' },
    });

    // 4. Route utilization metrics
    const routesWithAssignments = await prisma.transport_routes.findMany({
      where: { schoolId, status: RouteStatus.ACTIVE },
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: {
            vehicle: {
              select: {
                id: true,
                registrationNumber: true,
                name: true,
                capacity: true,
              },
            },
            driver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          take: 1,
        },
        _count: {
          select: {
            stops: true,
            allocations: { where: { status: AllocationStatus.ACTIVE } },
          },
        },
      },
      take: 10,
    });

    const routeUtilization = routesWithAssignments.map((route) => {
      const activeAssignment = route.assignments[0] || null;
      const capacity = activeAssignment?.vehicle?.capacity || 0;
      const allocated = route._count.allocations;
      const utilizationRate = capacity > 0 ? Math.round((allocated / capacity) * 100) : 0;

      return {
        id: route.id,
        code: route.code,
        name: route.name,
        startPoint: route.startPoint,
        destination: route.destination,
        stopsCount: route._count.stops,
        assignedVehicle: activeAssignment?.vehicle?.registrationNumber || null,
        assignedDriver: activeAssignment?.driver
          ? `${activeAssignment.driver.firstName} ${activeAssignment.driver.lastName}`
          : null,
        capacity,
        allocatedStudents: allocated,
        utilizationRate,
        isOverCapacity: capacity > 0 && allocated > capacity,
      };
    });

    // 5. Total transport fees invoiced
    const totalTransportRevenue = activeAllocations.reduce(
      (sum, item) => sum + Number(item.fare || 0),
      0
    );

    return sendSuccess(res, {
      summary: {
        totalVehicles,
        activeVehicles,
        maintenanceVehicles,
        inactiveVehicles,
        totalRoutes,
        activeRoutes,
        totalDrivers,
        activeDrivers,
        totalStudents,
        allocatedStudents: allocatedStudentsCount,
        unallocatedStudents: unallocatedStudentsCount,
        totalTransportMonthlyRevenue: totalTransportRevenue,
        expiringDocumentsCount: vehiclesWithExpiringDocs.length,
        expiringLicensesCount: expiringDriverLicenses.length,
      },
      expiringVehicles: vehiclesWithExpiringDocs,
      expiringDrivers: expiringDriverLicenses,
      routeUtilization,
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. VEHICLE MANAGEMENT
// ==========================================

export const getVehicles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, status, type } = req.query;

    const where: Prisma.vehiclesWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as VehicleStatus;
    }
    if (type && typeof type === 'string') {
      where.type = type as any;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { manufacturer: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }

    const vehicles = await prisma.vehicles.findMany({
      where,
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: {
            route: { select: { id: true, code: true, name: true } },
            driver: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { registrationNumber: 'asc' },
    });

    return sendSuccess(res, vehicles);
  } catch (error) {
    return next(error);
  }
};

export const getVehicleById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const vehicle = await prisma.vehicles.findFirst({
      where: { id, schoolId },
      include: {
        assignments: {
          include: {
            route: true,
            driver: true,
          },
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });

    if (!vehicle) {
      return next(ApiError.notFound('Vehicle not found'));
    }

    return sendSuccess(res, vehicle);
  } catch (error) {
    return next(error);
  }
};

export const createVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      registrationNumber,
      name,
      type,
      capacity,
      manufacturer,
      model,
      registrationDate,
      insuranceExpiry,
      fitnessExpiry,
      permitExpiry,
      pollutionExpiry,
      status,
      photoUrl,
      documentId,
    } = req.body;

    const existing = await prisma.vehicles.findUnique({
      where: {
        schoolId_registrationNumber: {
          schoolId,
          registrationNumber,
        },
      },
    });

    if (existing) {
      return next(
        ApiError.badRequest(
          `Vehicle with registration number '${registrationNumber}' already exists in your school`
        )
      );
    }

    const vehicle = await prisma.vehicles.create({
      data: {
        schoolId,
        registrationNumber,
        name,
        type,
        capacity,
        manufacturer,
        model,
        registrationDate: registrationDate ? new Date(registrationDate) : null,
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        fitnessExpiry: fitnessExpiry ? new Date(fitnessExpiry) : null,
        permitExpiry: permitExpiry ? new Date(permitExpiry) : null,
        pollutionExpiry: pollutionExpiry ? new Date(pollutionExpiry) : null,
        status: status || VehicleStatus.ACTIVE,
        photoUrl,
        documentId,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'VEHICLE_CREATED',
      resource: 'vehicles',
      resourceId: vehicle.id,
      details: { registrationNumber, name, capacity, type },
      req,
    });

    return sendSuccess(res, vehicle, 'Vehicle registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      registrationNumber,
      name,
      type,
      capacity,
      manufacturer,
      model,
      registrationDate,
      insuranceExpiry,
      fitnessExpiry,
      permitExpiry,
      pollutionExpiry,
      status,
      photoUrl,
      documentId,
    } = req.body;

    const existing = await prisma.vehicles.findFirst({
      where: { id, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Vehicle not found'));
    }

    if (
      registrationNumber &&
      registrationNumber !== existing.registrationNumber
    ) {
      const duplicate = await prisma.vehicles.findUnique({
        where: {
          schoolId_registrationNumber: {
            schoolId,
            registrationNumber,
          },
        },
      });

      if (duplicate) {
        return next(
          ApiError.badRequest(
            `Vehicle with registration number '${registrationNumber}' already exists`
          )
        );
      }
    }

    const updated = await prisma.vehicles.update({
      where: { id },
      data: {
        registrationNumber: registrationNumber || undefined,
        name: name || undefined,
        type: type || undefined,
        capacity: capacity !== undefined ? capacity : undefined,
        manufacturer: manufacturer !== undefined ? manufacturer : undefined,
        model: model !== undefined ? model : undefined,
        registrationDate:
          registrationDate !== undefined
            ? registrationDate
              ? new Date(registrationDate)
              : null
            : undefined,
        insuranceExpiry:
          insuranceExpiry !== undefined
            ? insuranceExpiry
              ? new Date(insuranceExpiry)
              : null
            : undefined,
        fitnessExpiry:
          fitnessExpiry !== undefined
            ? fitnessExpiry
              ? new Date(fitnessExpiry)
              : null
            : undefined,
        permitExpiry:
          permitExpiry !== undefined
            ? permitExpiry
              ? new Date(permitExpiry)
              : null
            : undefined,
        pollutionExpiry:
          pollutionExpiry !== undefined
            ? pollutionExpiry
              ? new Date(pollutionExpiry)
              : null
            : undefined,
        status: status || undefined,
        photoUrl: photoUrl !== undefined ? photoUrl : undefined,
        documentId: documentId !== undefined ? documentId : undefined,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'VEHICLE_UPDATED',
      resource: 'vehicles',
      resourceId: id,
      details: { changes: req.body },
      req,
    });

    return sendSuccess(res, updated, 'Vehicle details updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const vehicle = await prisma.vehicles.findFirst({
      where: { id, schoolId },
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
        },
      },
    });

    if (!vehicle) {
      return next(ApiError.notFound('Vehicle not found'));
    }

    if (vehicle.assignments.length > 0) {
      return next(
        ApiError.badRequest(
          'Cannot delete vehicle with active route assignments. Please reassign or deactivate the vehicle instead.'
        )
      );
    }

    await prisma.vehicles.delete({
      where: { id },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'VEHICLE_DELETED',
      resource: 'vehicles',
      resourceId: id,
      details: { registrationNumber: vehicle.registrationNumber },
      req,
    });

    return sendSuccess(res, null, 'Vehicle deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 3. ROUTE & STOP MANAGEMENT
// ==========================================

export const getRoutes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, status } = req.query;

    const where: Prisma.transport_routesWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as RouteStatus;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { startPoint: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
      ];
    }

    const routes = await prisma.transport_routes.findMany({
      where,
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
        },
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: {
            vehicle: true,
            driver: true,
          },
          take: 1,
        },
        _count: {
          select: {
            allocations: { where: { status: AllocationStatus.ACTIVE } },
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return sendSuccess(res, routes);
  } catch (error) {
    return next(error);
  }
};

export const getRouteById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const route = await prisma.transport_routes.findFirst({
      where: { id, schoolId },
      include: {
        stops: {
          orderBy: { sequence: 'asc' },
        },
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: {
            vehicle: true,
            driver: true,
          },
        },
        allocations: {
          where: { status: AllocationStatus.ACTIVE },
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
              },
            },
            pickupStop: true,
            dropStop: true,
          },
        },
      },
    });

    if (!route) {
      return next(ApiError.notFound('Transport route not found'));
    }

    return sendSuccess(res, route);
  } catch (error) {
    return next(error);
  }
};

export const createRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      name,
      code,
      startPoint,
      destination,
      description,
      journeyDurationMinutes,
      status,
      stops = [],
    } = req.body;

    const existing = await prisma.transport_routes.findUnique({
      where: {
        schoolId_code: {
          schoolId,
          code,
        },
      },
    });

    if (existing) {
      return next(
        ApiError.badRequest(
          `Route with code '${code}' already exists in your school records`
        )
      );
    }

    // Check duplicate stop sequences if stops were provided
    if (stops.length > 0) {
      const sequences = stops.map((s: any) => s.sequence);
      const uniqueSeqs = new Set(sequences);
      if (sequences.length !== uniqueSeqs.size) {
        return next(
          ApiError.badRequest('Stop sequence numbers must be unique within a route')
        );
      }
    }

    const route = await prisma.$transaction(async (tx) => {
      const createdRoute = await tx.transport_routes.create({
        data: {
          schoolId,
          name,
          code,
          startPoint,
          destination,
          description,
          journeyDurationMinutes,
          status: status || RouteStatus.ACTIVE,
        },
      });

      if (stops.length > 0) {
        await tx.transport_stops.createMany({
          data: stops.map((s: any) => ({
            schoolId,
            routeId: createdRoute.id,
            name: s.name,
            address: s.address || null,
            sequence: s.sequence,
            pickupTime: s.pickupTime || null,
            dropTime: s.dropTime || null,
            fare: s.fare || 0,
          })),
        });
      }

      return tx.transport_routes.findUnique({
        where: { id: createdRoute.id },
        include: { stops: { orderBy: { sequence: 'asc' } } },
      });
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ROUTE_CREATED',
      resource: 'transport_routes',
      resourceId: route!.id,
      details: { code, name, stopsCount: stops.length },
      req,
    });

    return sendSuccess(res, route, 'Transport route created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      name,
      code,
      startPoint,
      destination,
      description,
      journeyDurationMinutes,
      status,
    } = req.body;

    const existing = await prisma.transport_routes.findFirst({
      where: { id, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Transport route not found'));
    }

    if (code && code !== existing.code) {
      const duplicate = await prisma.transport_routes.findUnique({
        where: {
          schoolId_code: {
            schoolId,
            code,
          },
        },
      });
      if (duplicate) {
        return next(
          ApiError.badRequest(`Route with code '${code}' already exists`)
        );
      }
    }

    const updated = await prisma.transport_routes.update({
      where: { id },
      data: {
        name: name || undefined,
        code: code || undefined,
        startPoint: startPoint || undefined,
        destination: destination || undefined,
        description: description !== undefined ? description : undefined,
        journeyDurationMinutes:
          journeyDurationMinutes !== undefined ? journeyDurationMinutes : undefined,
        status: status || undefined,
      },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ROUTE_UPDATED',
      resource: 'transport_routes',
      resourceId: id,
      details: { changes: req.body },
      req,
    });

    return sendSuccess(res, updated, 'Route updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const route = await prisma.transport_routes.findFirst({
      where: { id, schoolId },
      include: {
        allocations: { where: { status: AllocationStatus.ACTIVE } },
        assignments: { where: { status: AssignmentStatus.ACTIVE } },
      },
    });

    if (!route) {
      return next(ApiError.notFound('Route not found'));
    }

    if (route.allocations.length > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete route '${route.name}'. It currently has ${route.allocations.length} active student transport allocations.`
        )
      );
    }

    if (route.assignments.length > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete route '${route.name}'. It currently has active vehicle assignments.`
        )
      );
    }

    await prisma.transport_routes.delete({
      where: { id },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ROUTE_DELETED',
      resource: 'transport_routes',
      resourceId: id,
      details: { code: route.code, name: route.name },
      req,
    });

    return sendSuccess(res, null, 'Route and associated stops deleted');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 4. STOP MANAGEMENT
// ==========================================

export const createStop = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { routeId, name, address, sequence, pickupTime, dropTime, fare } =
      req.body;

    const route = await prisma.transport_routes.findFirst({
      where: { id: routeId, schoolId },
    });

    if (!route) {
      return next(ApiError.notFound('Transport route not found in your school'));
    }

    // Check duplicate sequence in route
    const duplicate = await prisma.transport_stops.findUnique({
      where: {
        routeId_sequence: {
          routeId,
          sequence,
        },
      },
    });

    if (duplicate) {
      return next(
        ApiError.badRequest(
          `Stop sequence #${sequence} already exists for this route ('${duplicate.name}'). Choose another sequence or reorder stops.`
        )
      );
    }

    const stop = await prisma.transport_stops.create({
      data: {
        schoolId,
        routeId,
        name,
        address,
        sequence,
        pickupTime,
        dropTime,
        fare: fare || 0,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STOP_CREATED',
      resource: 'transport_stops',
      resourceId: stop.id,
      details: { routeId, name, sequence, fare },
      req,
    });

    return sendSuccess(res, stop, 'Stop created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateStop = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { name, address, sequence, pickupTime, dropTime, fare } = req.body;

    const stop = await prisma.transport_stops.findFirst({
      where: { id, schoolId },
    });

    if (!stop) {
      return next(ApiError.notFound('Stop not found'));
    }

    if (sequence && sequence !== stop.sequence) {
      const duplicate = await prisma.transport_stops.findUnique({
        where: {
          routeId_sequence: {
            routeId: stop.routeId,
            sequence,
          },
        },
      });

      if (duplicate) {
        return next(
          ApiError.badRequest(
            `Stop sequence #${sequence} is already taken by '${duplicate.name}'`
          )
        );
      }
    }

    const updated = await prisma.transport_stops.update({
      where: { id },
      data: {
        name: name || undefined,
        address: address !== undefined ? address : undefined,
        sequence: sequence !== undefined ? sequence : undefined,
        pickupTime: pickupTime !== undefined ? pickupTime : undefined,
        dropTime: dropTime !== undefined ? dropTime : undefined,
        fare: fare !== undefined ? fare : undefined,
      },
    });

    return sendSuccess(res, updated, 'Stop updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteStop = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const stop = await prisma.transport_stops.findFirst({
      where: { id, schoolId },
      include: {
        pickupAllocations: { where: { status: AllocationStatus.ACTIVE } },
        dropAllocations: { where: { status: AllocationStatus.ACTIVE } },
      },
    });

    if (!stop) {
      return next(ApiError.notFound('Stop not found'));
    }

    if (
      stop.pickupAllocations.length > 0 ||
      stop.dropAllocations.length > 0
    ) {
      return next(
        ApiError.badRequest(
          `Cannot delete stop '${stop.name}'. Students currently have active pickup or drop allocations associated with it.`
        )
      );
    }

    await prisma.transport_stops.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Stop deleted successfully');
  } catch (error) {
    return next(error);
  }
};

export const reorderStops = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { routeId, stops } = req.body;

    const route = await prisma.transport_routes.findFirst({
      where: { id: routeId, schoolId },
    });

    if (!route) {
      return next(ApiError.notFound('Route not found'));
    }

    // Verify all stops belong to route and school
    const existingStops = await prisma.transport_stops.findMany({
      where: { routeId, schoolId },
    });

    const existingMap = new Map(existingStops.map((s) => [s.id, s]));
    for (const item of stops) {
      if (!existingMap.has(item.id)) {
        return next(
          ApiError.badRequest(`Stop ${item.id} does not belong to this route`)
        );
      }
    }

    // Use transaction with temporary negative sequences to prevent unique constraint conflict during swap
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < stops.length; i++) {
        await tx.transport_stops.update({
          where: { id: stops[i].id },
          data: { sequence: -(i + 1) },
        });
      }
      for (const item of stops) {
        await tx.transport_stops.update({
          where: { id: item.id },
          data: { sequence: item.sequence },
        });
      }
    });

    const updatedStops = await prisma.transport_stops.findMany({
      where: { routeId },
      orderBy: { sequence: 'asc' },
    });

    return sendSuccess(res, updatedStops, 'Stops reordered successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 5. DRIVER MANAGEMENT
// ==========================================

export const getDrivers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, status } = req.query;

    const where: Prisma.driversWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as DriverStatus;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { employeeId: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const drivers = await prisma.drivers.findMany({
      where,
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: {
            vehicle: true,
            route: true,
          },
          take: 1,
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return sendSuccess(res, drivers);
  } catch (error) {
    return next(error);
  }
};

export const getDriverById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const driver = await prisma.drivers.findFirst({
      where: { id, schoolId },
      include: {
        assignments: {
          include: {
            vehicle: true,
            route: true,
          },
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });

    if (!driver) {
      return next(ApiError.notFound('Driver profile not found'));
    }

    return sendSuccess(res, driver);
  } catch (error) {
    return next(error);
  }
};

export const createDriver = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      employeeId,
      firstName,
      lastName,
      phone,
      email,
      address,
      emergencyContact,
      licenseNumber,
      licenseExpiry,
      status,
      photo,
    } = req.body;

    // Check unique employeeId
    const existingEmp = await prisma.drivers.findUnique({
      where: {
        schoolId_employeeId: {
          schoolId,
          employeeId,
        },
      },
    });

    if (existingEmp) {
      return next(
        ApiError.badRequest(
          `Staff/Driver with Employee ID '${employeeId}' already exists in your school`
        )
      );
    }

    // Check unique licenseNumber
    const existingLic = await prisma.drivers.findUnique({
      where: {
        schoolId_licenseNumber: {
          schoolId,
          licenseNumber,
        },
      },
    });

    if (existingLic) {
      return next(
        ApiError.badRequest(
          `Driver with Driving License '${licenseNumber}' already exists in your school`
        )
      );
    }

    const driver = await prisma.drivers.create({
      data: {
        schoolId,
        employeeId,
        firstName,
        lastName,
        phone,
        email,
        address,
        emergencyContact,
        licenseNumber,
        licenseExpiry: new Date(licenseExpiry),
        status: status || DriverStatus.ACTIVE,
        photo,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DRIVER_CREATED',
      resource: 'drivers',
      resourceId: driver.id,
      details: { employeeId, name: `${firstName} ${lastName}`, licenseNumber },
      req,
    });

    return sendSuccess(res, driver, 'Driver registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateDriver = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      employeeId,
      firstName,
      lastName,
      phone,
      email,
      address,
      emergencyContact,
      licenseNumber,
      licenseExpiry,
      status,
      photo,
    } = req.body;

    const existing = await prisma.drivers.findFirst({
      where: { id, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Driver profile not found'));
    }

    if (employeeId && employeeId !== existing.employeeId) {
      const dupEmp = await prisma.drivers.findUnique({
        where: {
          schoolId_employeeId: {
            schoolId,
            employeeId,
          },
        },
      });
      if (dupEmp) {
        return next(
          ApiError.badRequest(`Employee ID '${employeeId}' is already registered`)
        );
      }
    }

    if (licenseNumber && licenseNumber !== existing.licenseNumber) {
      const dupLic = await prisma.drivers.findUnique({
        where: {
          schoolId_licenseNumber: {
            schoolId,
            licenseNumber,
          },
        },
      });
      if (dupLic) {
        return next(
          ApiError.badRequest(
            `Driving license '${licenseNumber}' is already registered`
          )
        );
      }
    }

    const updated = await prisma.drivers.update({
      where: { id },
      data: {
        employeeId: employeeId || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || undefined,
        email: email !== undefined ? email : undefined,
        address: address !== undefined ? address : undefined,
        emergencyContact:
          emergencyContact !== undefined ? emergencyContact : undefined,
        licenseNumber: licenseNumber || undefined,
        licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : undefined,
        status: status || undefined,
        photo: photo !== undefined ? photo : undefined,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DRIVER_UPDATED',
      resource: 'drivers',
      resourceId: id,
      details: { changes: req.body },
      req,
    });

    return sendSuccess(res, updated, 'Driver profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteDriver = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const driver = await prisma.drivers.findFirst({
      where: { id, schoolId },
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
        },
      },
    });

    if (!driver) {
      return next(ApiError.notFound('Driver not found'));
    }

    if (driver.assignments.length > 0) {
      return next(
        ApiError.badRequest(
          'Cannot delete driver with active vehicle assignments. Please reassign or update driver status to Inactive.'
        )
      );
    }

    await prisma.drivers.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Driver profile deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 6. VEHICLE & ROUTE ASSIGNMENT
// ==========================================

export const getAssignments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { status, routeId, vehicleId, driverId } = req.query;

    const where: Prisma.vehicle_assignmentsWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as AssignmentStatus;
    }
    if (routeId && typeof routeId === 'string') {
      where.routeId = routeId;
    }
    if (vehicleId && typeof vehicleId === 'string') {
      where.vehicleId = vehicleId;
    }
    if (driverId && typeof driverId === 'string') {
      where.driverId = driverId;
    }

    const assignments = await prisma.vehicle_assignments.findMany({
      where,
      include: {
        vehicle: true,
        route: true,
        driver: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });

    return sendSuccess(res, assignments);
  } catch (error) {
    return next(error);
  }
};

export const createAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      vehicleId,
      routeId,
      driverId,
      attendantName,
      attendantPhone,
      effectiveDate,
      endDate,
      status,
    } = req.body;

    const start = effectiveDate ? new Date(effectiveDate) : new Date();
    const end = endDate ? new Date(endDate) : null;

    if (end && end < start) {
      return next(ApiError.badRequest('End date cannot precede effective date'));
    }

    // 1. Verify vehicle belongs to school and is ACTIVE
    const vehicle = await prisma.vehicles.findFirst({
      where: { id: vehicleId, schoolId },
    });
    if (!vehicle) {
      return next(ApiError.notFound('Vehicle not found in your school records'));
    }
    if (vehicle.status !== VehicleStatus.ACTIVE) {
      return next(
        ApiError.badRequest(
          `Vehicle '${vehicle.registrationNumber}' is currently ${vehicle.status} and cannot be assigned`
        )
      );
    }

    // 2. Verify route belongs to school and is ACTIVE
    const route = await prisma.transport_routes.findFirst({
      where: { id: routeId, schoolId },
    });
    if (!route) {
      return next(ApiError.notFound('Transport route not found'));
    }
    if (route.status !== RouteStatus.ACTIVE) {
      return next(
        ApiError.badRequest(
          `Route '${route.name}' is currently INACTIVE and cannot receive assignments`
        )
      );
    }

    // 3. Verify driver belongs to school and is ACTIVE
    const driver = await prisma.drivers.findFirst({
      where: { id: driverId, schoolId },
    });
    if (!driver) {
      return next(ApiError.notFound('Driver profile not found'));
    }
    if (driver.status !== DriverStatus.ACTIVE) {
      return next(
        ApiError.badRequest(
          `Driver '${driver.firstName} ${driver.lastName}' is currently ${driver.status} and cannot be assigned`
        )
      );
    }

    // 4. Overlap conflict checks
    // A) Check vehicle active assignments
    const activeVehicleAssignment = await prisma.vehicle_assignments.findFirst({
      where: {
        schoolId,
        vehicleId,
        status: AssignmentStatus.ACTIVE,
        OR: [
          { endDate: null },
          { endDate: { gte: start } },
        ],
      },
      include: { route: true },
    });

    if (activeVehicleAssignment) {
      return next(
        ApiError.badRequest(
          `Vehicle '${vehicle.registrationNumber}' already has an active assignment to route '${activeVehicleAssignment.route.name}'. Deactivate or end previous assignment first.`
        )
      );
    }

    // B) Check driver active assignments
    const activeDriverAssignment = await prisma.vehicle_assignments.findFirst({
      where: {
        schoolId,
        driverId,
        status: AssignmentStatus.ACTIVE,
        OR: [
          { endDate: null },
          { endDate: { gte: start } },
        ],
      },
      include: { route: true, vehicle: true },
    });

    if (activeDriverAssignment) {
      return next(
        ApiError.badRequest(
          `Driver '${driver.firstName} ${driver.lastName}' is already actively assigned to vehicle '${activeDriverAssignment.vehicle.registrationNumber}' on route '${activeDriverAssignment.route.name}'.`
        )
      );
    }

    const assignment = await prisma.vehicle_assignments.create({
      data: {
        schoolId,
        vehicleId,
        routeId,
        driverId,
        attendantName,
        attendantPhone,
        effectiveDate: start,
        endDate: end,
        status: status || AssignmentStatus.ACTIVE,
      },
      include: {
        vehicle: true,
        route: true,
        driver: true,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'VEHICLE_ASSIGNMENT_CREATED',
      resource: 'vehicle_assignments',
      resourceId: assignment.id,
      details: {
        vehicle: vehicle.registrationNumber,
        route: route.code,
        driver: `${driver.firstName} ${driver.lastName}`,
      },
      req,
    });

    return sendSuccess(
      res,
      assignment,
      'Vehicle assigned to route successfully',
      201
    );
  } catch (error) {
    return next(error);
  }
};

export const updateAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      vehicleId,
      routeId,
      driverId,
      attendantName,
      attendantPhone,
      effectiveDate,
      endDate,
      status,
    } = req.body;

    const existing = await prisma.vehicle_assignments.findFirst({
      where: { id, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Vehicle assignment not found'));
    }

    const updated = await prisma.vehicle_assignments.update({
      where: { id },
      data: {
        vehicleId: vehicleId || undefined,
        routeId: routeId || undefined,
        driverId: driverId || undefined,
        attendantName:
          attendantName !== undefined ? attendantName : undefined,
        attendantPhone:
          attendantPhone !== undefined ? attendantPhone : undefined,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
        endDate:
          endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined,
        status: status || undefined,
      },
      include: {
        vehicle: true,
        route: true,
        driver: true,
      },
    });

    return sendSuccess(res, updated, 'Assignment updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const assignment = await prisma.vehicle_assignments.findFirst({
      where: { id, schoolId },
    });

    if (!assignment) {
      return next(ApiError.notFound('Assignment record not found'));
    }

    await prisma.vehicle_assignments.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Assignment record removed');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 7. STUDENT TRANSPORT ALLOCATION & FEES
// ==========================================

export const getStudentAllocations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, status, routeId, academicYearId, classId } = req.query;

    const where: Prisma.student_transport_allocationsWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as AllocationStatus;
    }
    if (routeId && typeof routeId === 'string') {
      where.routeId = routeId;
    }
    if (academicYearId && typeof academicYearId === 'string') {
      where.academicYearId = academicYearId;
    }
    if (search && typeof search === 'string') {
      where.student = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { admissionNumber: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    if (classId && typeof classId === 'string') {
      where.student = {
        student_enrollments: {
          some: { classId, status: 'ACTIVE' },
        },
      };
    }

    const allocations = await prisma.student_transport_allocations.findMany({
      where,
      include: {
        student: {
          include: {
            student_enrollments: {
              where: { status: 'ACTIVE' },
              include: { classes: true, sections: true },
              take: 1,
            },
          },
        },
        academicYear: true,
        route: true,
        pickupStop: true,
        dropStop: true,
        invoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, allocations);
  } catch (error) {
    return next(error);
  }
};

export const createStudentAllocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      studentId,
      academicYearId,
      routeId,
      pickupStopId,
      dropStopId,
      effectiveDate,
      endDate,
      fare,
      status,
      generateInvoice = false,
      dueDate,
    } = req.body;

    const start = effectiveDate ? new Date(effectiveDate) : new Date();
    const end = endDate ? new Date(endDate) : null;

    // 1. Verify student belongs to school
    const student = await prisma.students.findFirst({
      where: { id: studentId, schoolId },
    });
    if (!student) {
      return next(ApiError.notFound('Student not found in your school records'));
    }

    // 2. Verify academic year belongs to school
    const academicYear = await prisma.academic_years.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!academicYear) {
      return next(ApiError.notFound('Academic year not found'));
    }

    // 3. Verify route belongs to school
    const route = await prisma.transport_routes.findFirst({
      where: { id: routeId, schoolId },
      include: {
        assignments: {
          where: { status: AssignmentStatus.ACTIVE },
          include: { vehicle: true },
          take: 1,
        },
      },
    });
    if (!route) {
      return next(ApiError.notFound('Transport route not found'));
    }

    // 4. Verify pickup and drop stops belong to this route and school
    const [pickupStop, dropStop] = await Promise.all([
      prisma.transport_stops.findFirst({
        where: { id: pickupStopId, routeId, schoolId },
      }),
      prisma.transport_stops.findFirst({
        where: { id: dropStopId, routeId, schoolId },
      }),
    ]);

    if (!pickupStop) {
      return next(
        ApiError.badRequest('Pickup stop does not belong to the selected route')
      );
    }
    if (!dropStop) {
      return next(
        ApiError.badRequest('Drop stop does not belong to the selected route')
      );
    }

    // 5. Prevent duplicate active allocation for the same student in this academic year
    const existingActiveAllocation =
      await prisma.student_transport_allocations.findFirst({
        where: {
          schoolId,
          studentId,
          academicYearId,
          status: AllocationStatus.ACTIVE,
          OR: [
            { endDate: null },
            { endDate: { gte: start } },
          ],
        },
        include: { route: true },
      });

    if (existingActiveAllocation) {
      return next(
        ApiError.badRequest(
          `Student is already actively allocated to route '${existingActiveAllocation.route.name}' for this academic year. End or cancel existing allocation first.`
        )
      );
    }

    // 6. Check vehicle seating capacity warning/validation
    const activeAssignment = route.assignments[0];
    if (activeAssignment?.vehicle) {
      const activeAllocationsCount =
        await prisma.student_transport_allocations.count({
          where: {
            schoolId,
            routeId,
            status: AllocationStatus.ACTIVE,
          },
        });

      if (activeAllocationsCount >= activeAssignment.vehicle.capacity) {
        return next(
          ApiError.badRequest(
            `Route vehicle '${activeAssignment.vehicle.registrationNumber}' has reached its maximum seating capacity (${activeAssignment.vehicle.capacity} seats, ${activeAllocationsCount} active allocations).`
          )
        );
      }
    }

    // 7. Calculate fare (provided fare > pickupStop.fare > 0)
    const resolvedFare =
      fare !== undefined && fare !== null
        ? Number(fare)
        : Number(pickupStop.fare || 0);

    // 8. Transaction: Create allocation and optional fee invoice
    const allocation = await prisma.$transaction(async (tx) => {
      let createdInvoiceId: string | null = null;

      if (generateInvoice && resolvedFare > 0) {
        const invoiceNumber = generateDocumentNumber('TRN');
        const invoiceDueDate = dueDate
          ? new Date(dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const newInvoice = await tx.student_fee_invoices.create({
          data: {
            schoolId,
            invoiceNumber,
            studentId,
            academicYearId,
            title: `Transport Fee - ${route.name} (${route.code})`,
            baseAmount: resolvedFare,
            discount: 0,
            lateFee: 0,
            totalAmount: resolvedFare,
            paidAmount: 0,
            balance: resolvedFare,
            status: InvoiceStatus.PENDING,
            dueDate: invoiceDueDate,
          },
        });
        createdInvoiceId = newInvoice.id;
      }

      const createdAllocation = await tx.student_transport_allocations.create({
        data: {
          schoolId,
          studentId,
          academicYearId,
          routeId,
          pickupStopId,
          dropStopId,
          effectiveDate: start,
          endDate: end,
          fare: resolvedFare,
          status: status || AllocationStatus.ACTIVE,
          invoiceId: createdInvoiceId,
        },
        include: {
          student: true,
          academicYear: true,
          route: true,
          pickupStop: true,
          dropStop: true,
          invoice: true,
        },
      });

      return createdAllocation;
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STUDENT_TRANSPORT_ALLOCATED',
      resource: 'student_transport_allocations',
      resourceId: allocation.id,
      details: {
        student: `${student.firstName} ${student.lastName}`,
        route: route.name,
        pickupStop: pickupStop.name,
        fare: resolvedFare,
        invoiceGenerated: Boolean(allocation.invoiceId),
      },
      req,
    });

    return sendSuccess(
      res,
      allocation,
      'Student transport allocation created successfully',
      201
    );
  } catch (error) {
    return next(error);
  }
};

export const updateStudentAllocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      pickupStopId,
      dropStopId,
      endDate,
      fare,
      status,
      generateInvoice = false,
      dueDate,
    } = req.body;

    const existing = await prisma.student_transport_allocations.findFirst({
      where: { id, schoolId },
      include: { route: true, student: true },
    });

    if (!existing) {
      return next(ApiError.notFound('Transport allocation record not found'));
    }

    if (pickupStopId && pickupStopId !== existing.pickupStopId) {
      const stop = await prisma.transport_stops.findFirst({
        where: { id: pickupStopId, routeId: existing.routeId, schoolId },
      });
      if (!stop) {
        return next(
          ApiError.badRequest('Pickup stop does not belong to this route')
        );
      }
    }

    if (dropStopId && dropStopId !== existing.dropStopId) {
      const stop = await prisma.transport_stops.findFirst({
        where: { id: dropStopId, routeId: existing.routeId, schoolId },
      });
      if (!stop) {
        return next(
          ApiError.badRequest('Drop stop does not belong to this route')
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      let linkedInvoiceId = existing.invoiceId;

      // Generate invoice if requested and none exists
      if (generateInvoice && !linkedInvoiceId) {
        const resolvedFare =
          fare !== undefined ? Number(fare) : Number(existing.fare);
        if (resolvedFare > 0) {
          const invoiceNumber = generateDocumentNumber('TRN');
          const invoiceDueDate = dueDate
            ? new Date(dueDate)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          const newInvoice = await tx.student_fee_invoices.create({
            data: {
              schoolId,
              invoiceNumber,
              studentId: existing.studentId,
              academicYearId: existing.academicYearId,
              title: `Transport Fee - ${existing.route.name}`,
              baseAmount: resolvedFare,
              totalAmount: resolvedFare,
              balance: resolvedFare,
              status: InvoiceStatus.PENDING,
              dueDate: invoiceDueDate,
            },
          });
          linkedInvoiceId = newInvoice.id;
        }
      }

      return tx.student_transport_allocations.update({
        where: { id },
        data: {
          pickupStopId: pickupStopId || undefined,
          dropStopId: dropStopId || undefined,
          endDate:
            endDate !== undefined
              ? endDate
                ? new Date(endDate)
                : null
              : undefined,
          fare: fare !== undefined ? fare : undefined,
          status: status || undefined,
          invoiceId: linkedInvoiceId || undefined,
        },
        include: {
          student: true,
          route: true,
          pickupStop: true,
          dropStop: true,
          invoice: true,
        },
      });
    });

    return sendSuccess(
      res,
      updated,
      'Student transport allocation updated successfully'
    );
  } catch (error) {
    return next(error);
  }
};

export const deleteStudentAllocation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const allocation = await prisma.student_transport_allocations.findFirst({
      where: { id, schoolId },
      include: {
        invoice: {
          include: { fee_payments: true },
        },
      },
    });

    if (!allocation) {
      return next(ApiError.notFound('Transport allocation record not found'));
    }

    if (
      allocation.invoice &&
      (Number(allocation.invoice.paidAmount) > 0 ||
        allocation.invoice.fee_payments.length > 0)
    ) {
      return next(
        ApiError.badRequest(
          'Cannot delete transport allocation with paid or partially paid fees. Please cancel or update the allocation status instead.'
        )
      );
    }

    await prisma.student_transport_allocations.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Transport allocation removed successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 8. REPORTS & CSV EXPORT
// ==========================================

export const getTransportReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { reportType, format } = req.query;

    switch (reportType) {
      case 'vehicles': {
        const data = await prisma.vehicles.findMany({
          where: { schoolId },
          include: {
            assignments: {
              where: { status: AssignmentStatus.ACTIVE },
              include: { route: true, driver: true },
              take: 1,
            },
          },
          orderBy: { registrationNumber: 'asc' },
        });

        if (format === 'csv') {
          const headers = [
            'Registration Number',
            'Name',
            'Type',
            'Capacity',
            'Manufacturer',
            'Model',
            'Status',
            'Active Route',
            'Assigned Driver',
            'Insurance Expiry',
            'Fitness Expiry',
          ];
          const rows = data.map((v) => {
            const activeAssign = v.assignments[0];
            return [
              escapeCsv(v.registrationNumber),
              escapeCsv(v.name),
              escapeCsv(v.type),
              escapeCsv(v.capacity),
              escapeCsv(v.manufacturer || ''),
              escapeCsv(v.model || ''),
              escapeCsv(v.status),
              escapeCsv(activeAssign?.route?.name || 'Unassigned'),
              escapeCsv(
                activeAssign?.driver
                  ? `${activeAssign.driver.firstName} ${activeAssign.driver.lastName}`
                  : 'None'
              ),
              escapeCsv(v.insuranceExpiry?.toISOString().slice(0, 10) || 'N/A'),
              escapeCsv(v.fitnessExpiry?.toISOString().slice(0, 10) || 'N/A'),
            ].join(',');
          });

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename=vehicles_report.csv'
          );
          return res.status(200).send([headers.join(','), ...rows].join('\n'));
        }

        return sendSuccess(res, data);
      }

      case 'routes': {
        const data = await prisma.transport_routes.findMany({
          where: { schoolId },
          include: {
            stops: { orderBy: { sequence: 'asc' } },
            assignments: {
              where: { status: AssignmentStatus.ACTIVE },
              include: { vehicle: true, driver: true },
              take: 1,
            },
            _count: {
              select: {
                allocations: { where: { status: AllocationStatus.ACTIVE } },
              },
            },
          },
          orderBy: { code: 'asc' },
        });

        if (format === 'csv') {
          const headers = [
            'Route Code',
            'Route Name',
            'Start Point',
            'Destination',
            'Duration (Min)',
            'Stops Count',
            'Allocated Students',
            'Assigned Vehicle',
            'Assigned Driver',
            'Status',
          ];
          const rows = data.map((r) => {
            const assign = r.assignments[0];
            return [
              escapeCsv(r.code),
              escapeCsv(r.name),
              escapeCsv(r.startPoint),
              escapeCsv(r.destination),
              escapeCsv(r.journeyDurationMinutes || ''),
              escapeCsv(r.stops.length),
              escapeCsv(r._count.allocations),
              escapeCsv(assign?.vehicle?.registrationNumber || 'None'),
              escapeCsv(
                assign?.driver
                  ? `${assign.driver.firstName} ${assign.driver.lastName}`
                  : 'None'
              ),
              escapeCsv(r.status),
            ].join(',');
          });

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename=routes_report.csv'
          );
          return res.status(200).send([headers.join(','), ...rows].join('\n'));
        }

        return sendSuccess(res, data);
      }

      case 'allocations': {
        const data = await prisma.student_transport_allocations.findMany({
          where: { schoolId },
          include: {
            student: {
              include: {
                student_enrollments: {
                  where: { status: 'ACTIVE' },
                  include: { classes: true, sections: true },
                  take: 1,
                },
              },
            },
            route: true,
            pickupStop: true,
            dropStop: true,
            invoice: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (format === 'csv') {
          const headers = [
            'Admission No',
            'Student Name',
            'Class',
            'Section',
            'Route Code',
            'Route Name',
            'Pickup Stop',
            'Pickup Time',
            'Drop Stop',
            'Drop Time',
            'Monthly Fare',
            'Status',
            'Invoice No',
            'Invoice Status',
          ];
          const rows = data.map((a) => {
            const enroll = a.student.student_enrollments[0];
            return [
              escapeCsv(a.student.admissionNumber),
              escapeCsv(`${a.student.firstName} ${a.student.lastName}`),
              escapeCsv(enroll?.classes?.name || 'N/A'),
              escapeCsv(enroll?.sections?.name || 'N/A'),
              escapeCsv(a.route.code),
              escapeCsv(a.route.name),
              escapeCsv(a.pickupStop.name),
              escapeCsv(a.pickupStop.pickupTime || 'N/A'),
              escapeCsv(a.dropStop.name),
              escapeCsv(a.dropStop.dropTime || 'N/A'),
              escapeCsv(a.fare),
              escapeCsv(a.status),
              escapeCsv(a.invoice?.invoiceNumber || 'No Invoice'),
              escapeCsv(a.invoice?.status || 'N/A'),
            ].join(',');
          });

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename=student_allocations_report.csv'
          );
          return res.status(200).send([headers.join(','), ...rows].join('\n'));
        }

        return sendSuccess(res, data);
      }

      case 'drivers': {
        const data = await prisma.drivers.findMany({
          where: { schoolId },
          include: {
            assignments: {
              where: { status: AssignmentStatus.ACTIVE },
              include: { vehicle: true, route: true },
              take: 1,
            },
          },
          orderBy: { employeeId: 'asc' },
        });

        if (format === 'csv') {
          const headers = [
            'Staff ID',
            'Driver Name',
            'Phone',
            'Email',
            'License Number',
            'License Expiry',
            'Status',
            'Assigned Vehicle',
            'Assigned Route',
          ];
          const rows = data.map((d) => {
            const assign = d.assignments[0];
            return [
              escapeCsv(d.employeeId),
              escapeCsv(`${d.firstName} ${d.lastName}`),
              escapeCsv(d.phone),
              escapeCsv(d.email || ''),
              escapeCsv(d.licenseNumber),
              escapeCsv(d.licenseExpiry.toISOString().slice(0, 10)),
              escapeCsv(d.status),
              escapeCsv(assign?.vehicle?.registrationNumber || 'Unassigned'),
              escapeCsv(assign?.route?.name || 'Unassigned'),
            ].join(',');
          });

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename=drivers_report.csv'
          );
          return res.status(200).send([headers.join(','), ...rows].join('\n'));
        }

        return sendSuccess(res, data);
      }

      default: {
        return next(
          ApiError.badRequest(
            "Invalid reportType. Permitted types: 'vehicles', 'routes', 'allocations', 'drivers'"
          )
        );
      }
    }
  } catch (error) {
    return next(error);
  }
};

