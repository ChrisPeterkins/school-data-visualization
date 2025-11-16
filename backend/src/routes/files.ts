import { FastifyPluginAsync } from 'fastify';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs/promises';

const filesRoutes: FastifyPluginAsync = async (fastify) => {
  const sourcePath = path.join(process.cwd(), '..', 'sources');

  // Get list of all Excel files
  fastify.get('/list', async (request, reply) => {
    const directories = [
      'pssa/school',
      'pssa/district',
      'pssa/state',
      'keystone/school',
      'keystone/district',
      'keystone/state'
    ];

    const fileList: Array<{ path: string; name: string; category: string; type: string }> = [];

    for (const dir of directories) {
      const dirPath = path.join(sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx'));

        for (const file of xlsxFiles) {
          const [type, level] = dir.split('/');
          fileList.push({
            path: dir + '/' + file,
            name: file,
            category: `${type.toUpperCase()} - ${level.charAt(0).toUpperCase() + level.slice(1)}`,
            type: type
          });
        }
      } catch (error) {
        // Directory might not exist, continue
      }
    }

    return fileList.sort((a, b) => a.name.localeCompare(b.name));
  });

  // Get Excel file data as JSON with pagination
  fastify.get('/data', async (request, reply) => {
    const { file, page = '1', limit = '500' } = request.query as {
      file: string;
      page?: string;
      limit?: string;
    };

    if (!file) {
      return reply.status(400).send({ error: 'File parameter required' });
    }

    // Security: ensure file path doesn't escape sources directory
    const normalizedPath = path.normalize(file);
    if (normalizedPath.includes('..')) {
      return reply.status(400).send({ error: 'Invalid file path' });
    }

    const filePath = path.join(sourcePath, normalizedPath);
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    try {
      // Check if file exists
      await fs.access(filePath);

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get full data first to count rows
      const fullData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      }) as any[][];

      const totalRows = fullData.length;
      const totalPages = Math.ceil(totalRows / limitNum);

      // Paginate data
      const startIdx = (pageNum - 1) * limitNum;
      const endIdx = Math.min(startIdx + limitNum, totalRows);
      const paginatedData = fullData.slice(startIdx, endIdx);

      // Get sheet names
      const sheets = workbook.SheetNames;

      return {
        fileName: path.basename(filePath),
        sheets,
        activeSheet: sheetName,
        data: paginatedData,
        page: pageNum,
        limit: limitNum,
        totalRows,
        totalPages,
        rowCount: paginatedData.length,
        columnCount: fullData.length > 0 ? fullData[0].length : 0
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.status(404).send({ error: 'File not found' });
      }
      throw error;
    }
  });

  // Get specific sheet from Excel file
  fastify.get('/sheet', async (request, reply) => {
    const { file, sheet } = request.query as { file: string; sheet: string };

    if (!file) {
      return reply.status(400).send({ error: 'File parameter required' });
    }

    // Security check
    const normalizedPath = path.normalize(file);
    if (normalizedPath.includes('..')) {
      return reply.status(400).send({ error: 'Invalid file path' });
    }

    const filePath = path.join(sourcePath, normalizedPath);

    try {
      await fs.access(filePath);

      const workbook = XLSX.readFile(filePath);
      const sheetName = sheet || workbook.SheetNames[0];

      if (!workbook.Sheets[sheetName]) {
        return reply.status(404).send({ error: 'Sheet not found' });
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false
      });

      return {
        fileName: path.basename(filePath),
        sheetName,
        data,
        rowCount: data.length,
        columnCount: data.length > 0 ? (data[0] as any[]).length : 0
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return reply.status(404).send({ error: 'File not found' });
      }
      throw error;
    }
  });
};

export default filesRoutes;
