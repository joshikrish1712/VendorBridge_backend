import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        vendorProfile: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        vendorProfile: true,
      },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
      include: {
        vendorProfile: true,
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        vendorProfile: true,
      },
    });
  }

  async delete(id: string) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async findAll(where?: Prisma.UserWhereInput) {
    return prisma.user.findMany({
      where,
      include: {
        vendorProfile: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
