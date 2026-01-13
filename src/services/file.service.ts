import prisma from "../config/prisma.js";
import { NotFoundError, ErrorHandler } from "./error.services.js";
import { StorageFactory } from "./storage/storage.factory.js";
import { FileUpload } from "../interfaces/file-upload.interface.js";
import {
  paginate,
  PaginatedResult,
  Pagination,
  SortOptions,
} from "../utils/paginate.js";
import { File } from "../generated/prisma/client.js";

export class FileService {
  /**
   * Uploads a file to the specified provider and saves the record in the database
   */
  async uploadAndSave(
    file: FileUpload,
    providerType: string = "s3",
    meta: { user?: string; purpose?: string; folder?: string }
  ): Promise<File> {
    try {
      // 1. Upload to Cloud (DB Agnostic)
      const storageService = StorageFactory.getService(providerType);
      const result = await storageService.uploadFile(
        file,
        meta.folder || "uploads"
      );

      if (!result.success || !result.key || !result.url) {
        throw new Error(result.error || "Upload failed");
      }

      // 2. Save to Database
      const fileRecord = await prisma.file.create({
        data: {
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          provider: result.provider,
          key: result.key,
          url: result.url,
          userId: meta.user,
          purpose: meta.purpose,
        },
      });

      console.log(
        `File record created for ${fileRecord.name} (provider: ${fileRecord.provider}, key: ${fileRecord.key})`
      );
      return fileRecord;
    } catch (error) {
      console.error("Error uploading and saving file:", error);
      throw ErrorHandler.handleError(error);
    }
  }

  // --- STANDARD CRUD METHODS ---

  async getFileById(id: string): Promise<File> {
    try {
      const fileRecord = await prisma.file.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!fileRecord) {
        throw new NotFoundError("File record not found.");
      }
      return fileRecord;
    } catch (error) {
      throw ErrorHandler.handleError(error);
    }
  }

  async getFiles(
    pagination: Pagination,
    options?: {
      filter?: any; // Prisma WhereInput
      sort?: SortOptions;
    }
  ): Promise<PaginatedResult<File>> {
    try {
      const { filter, sort } = options || {};

      // Convert SortOptions to Prisma orderBy
      const orderBy = sort?.by
        ? { [sort.by as string]: sort.direction || "desc" }
        : { createdAt: "desc" };

      const files = await paginate<File, any>(
        prisma.file,
        {
          where: filter,
          orderBy,
          include: { user: true },
        },
        pagination
      );
      return files;
    } catch (error) {
      throw ErrorHandler.handleError(error);
    }
  }

  async deleteFile(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const fileRecord = await this.getFileById(id);

      // Delete from Cloud Provider
      const storageService = StorageFactory.getService(fileRecord.provider);
      await storageService.deleteFile(fileRecord.key);

      // Delete from Database
      await prisma.file.delete({ where: { id } });

      console.log(
        `Successfully deleted file record and ${fileRecord.provider} object for key: ${fileRecord.key}`
      );
      return { success: true, message: "File deleted successfully." };
    } catch (error) {
      throw ErrorHandler.handleError(error);
    }
  }
}
