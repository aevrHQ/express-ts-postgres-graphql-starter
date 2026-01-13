import { FileService } from "../../services/file.service.js";
import { UnauthorizedError } from "../../services/error.services.js";

const fileService = new FileService();

const fileResolvers = {
  Query: {
    getFile: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) throw new UnauthorizedError("Not authenticated");

      const file = await fileService.getFileById(id);

      // Ownership check (File has user included via service, but let's check userId or user.id)
      if (
        (file as any).userId &&
        (file as any).userId !== context.user.data.id
      ) {
        throw new UnauthorizedError("Access denied");
      }
      return file;
    },
    getFiles: async (
      _: any,
      { page, limit }: { page: number; limit: number },
      context: any
    ) => {
      if (!context.user) throw new UnauthorizedError("Not authenticated");

      const result = await fileService.getFiles(
        { page: page || 1, limit: limit || 10 },
        { filter: { userId: context.user.data.id } } // Updated filter to use userId
      );

      return {
        totalCount: result.meta.total,
        edges: result.data.map((file) => ({
          cursor: file.id,
          node: file,
        })),
        pageInfo: {
          hasNextPage: result.meta.hasNextPage,
          hasPreviousPage: result.meta.hasPrevPage,
          startCursor: result.data.length > 0 ? result.data[0].id : null,
          endCursor:
            result.data.length > 0
              ? result.data[result.data.length - 1].id
              : null,
        },
      };
    },
  },
  Mutation: {
    deleteFile: async (_: any, { id }: { id: string }, context: any) => {
      if (!context.user) throw new UnauthorizedError("Not authenticated");

      const file = await fileService.getFileById(id);
      if (
        (file as any).userId &&
        (file as any).userId !== context.user.data.id
      ) {
        throw new UnauthorizedError("Access denied");
      }

      return await fileService.deleteFile(id);
    },
  },
  File: {
    user: async (parent: any) => {
      if (parent.user) return parent.user;
      // If not populated, could fetch but service should handle it
      return null;
    },
  },
};

export default fileResolvers;
