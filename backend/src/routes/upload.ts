import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { logger } from '../utils/logger';

interface UploadQuery {
  type: string;
  level: string;
}

export default async function uploadRoutes(fastify: FastifyInstance) {
  // Upload endpoint - supports multiple files
  fastify.post('/upload', async (request: FastifyRequest<{ Querystring: UploadQuery }>, reply: FastifyReply) => {
    try {
      const { type, level } = request.query;

      if (!type || !level) {
        return reply.code(400).send({ error: 'Type and level parameters are required' });
      }

      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      const filename = data.filename;
      const ext = path.extname(filename).toLowerCase();

      if (!['.xlsx', '.xls'].includes(ext)) {
        return reply.code(400).send({ error: 'Only Excel files (.xlsx, .xls) are allowed' });
      }

      // Create upload directory
      const uploadPath = path.join(__dirname, '../../..', 'sources', type, level);
      await fs.mkdir(uploadPath, { recursive: true });

      // Save file
      const filePath = path.join(uploadPath, filename);
      await pipeline(data.file, createWriteStream(filePath));

      const stats = await fs.stat(filePath);

      logger.info(`Uploaded file to ${type}/${level}/${filename}`);

      return {
        success: true,
        message: 'File uploaded successfully',
        file: {
          filename,
          size: stats.size,
          path: `${type}/${level}/${filename}`
        }
      };
    } catch (error) {
      logger.error('Upload error:', error);
      return reply.code(500).send({
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Upload multiple files
  fastify.post('/upload-multiple', async (request: FastifyRequest<{ Querystring: UploadQuery }>, reply: FastifyReply) => {
    try {
      const { type, level } = request.query;

      if (!type || !level) {
        return reply.code(400).send({ error: 'Type and level parameters are required' });
      }

      const parts = request.parts();
      const uploadedFiles = [];

      // Create upload directory
      const uploadPath = path.join(__dirname, '../../..', 'sources', type, level);
      await fs.mkdir(uploadPath, { recursive: true });

      for await (const part of parts) {
        if (part.type === 'file') {
          const filename = part.filename;
          const ext = path.extname(filename).toLowerCase();

          if (!['.xlsx', '.xls'].includes(ext)) {
            continue; // Skip non-Excel files
          }

          const filePath = path.join(uploadPath, filename);
          await pipeline(part.file, createWriteStream(filePath));

          const stats = await fs.stat(filePath);
          uploadedFiles.push({
            filename,
            size: stats.size,
            path: `${type}/${level}/${filename}`
          });

          logger.info(`Uploaded file to ${type}/${level}/${filename}`);
        }
      }

      if (uploadedFiles.length === 0) {
        return reply.code(400).send({ error: 'No valid Excel files uploaded' });
      }

      return {
        success: true,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        files: uploadedFiles
      };
    } catch (error) {
      logger.error('Upload error:', error);
      return reply.code(500).send({
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // List uploaded files
  fastify.get('/files', async (request: FastifyRequest<{ Querystring: UploadQuery }>, reply: FastifyReply) => {
    try {
      const { type, level } = request.query;

      if (!type || !level) {
        return reply.code(400).send({ error: 'Type and level parameters are required' });
      }

      const dirPath = path.join(__dirname, '../../..', 'sources', type, level);

      try {
        await fs.access(dirPath);
      } catch {
        return { files: [] };
      }

      const fileNames = await fs.readdir(dirPath);
      const files = await Promise.all(
        fileNames
          .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
          .map(async (filename) => {
            const stats = await fs.stat(path.join(dirPath, filename));
            return {
              filename,
              size: stats.size,
              modified: stats.mtime
            };
          })
      );

      return { files };
    } catch (error) {
      logger.error('List files error:', error);
      return reply.code(500).send({ error: 'Failed to list files' });
    }
  });

  // Delete a file
  fastify.delete('/files/:type/:level/:filename', async (request: FastifyRequest<{
    Params: { type: string; level: string; filename: string }
  }>, reply: FastifyReply) => {
    try {
      const { type, level, filename } = request.params;
      const filePath = path.join(__dirname, '../../..', 'sources', type, level, filename);

      try {
        await fs.access(filePath);
      } catch {
        return reply.code(404).send({ error: 'File not found' });
      }

      await fs.unlink(filePath);
      logger.info(`Deleted file: ${type}/${level}/${filename}`);

      return { success: true, message: 'File deleted' };
    } catch (error) {
      logger.error('Delete file error:', error);
      return reply.code(500).send({ error: 'Failed to delete file' });
    }
  });
}
