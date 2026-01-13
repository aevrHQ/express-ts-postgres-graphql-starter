import { PrismaClient } from "@prisma/client";

export interface Pagination {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface SortOptions<T = any> {
  by?: keyof T | string;
  direction?: "asc" | "desc";
}

/**
 * Helper to paginate Prisma queries
 */
export const paginate = async <T, M>(
  model: any, // Prisma Delegate
  args: any = {}, // FindManyArgs
  pagination: Pagination
): Promise<PaginatedResult<T>> => {
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      ...args,
      skip,
      take: limit,
    }),
    model.count({ where: args.where }),
  ]);

  const pages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  };
};

export default paginate;
