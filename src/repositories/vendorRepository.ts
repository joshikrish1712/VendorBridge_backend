import { Prisma, Vendor, VendorStatus } from "@prisma/client";
import { prisma } from "../config/db";

export class VendorRepository {
  async findById(id: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string): Promise<Vendor | null> {
    return prisma.vendor.findUnique({
      where: { email },
    });
  }

  async create(data: Prisma.VendorCreateInput): Promise<Vendor> {
    return prisma.vendor.create({
      data,
    });
  }

  async update(id: string, data: Prisma.VendorUpdateInput): Promise<Vendor> {
    return prisma.vendor.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Vendor> {
    return prisma.vendor.delete({
      where: { id },
    });
  }

  async findAll(filters: { status?: VendorStatus; category?: string } = {}): Promise<Vendor[]> {
    const whereClause: Prisma.VendorWhereInput = {};

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.category) {
      whereClause.categories = {
        has: filters.category,
      };
    }

    return prisma.vendor.findMany({
      where: whereClause,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
