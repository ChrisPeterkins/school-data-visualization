import { FastifyPluginAsync } from 'fastify';
import { EventEmitter } from 'events';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { DataImporterFixed } from '../services/dataImporterFixed';
import { PVAASImporter } from '../services/pvaasImporter';
import { pssaResults, keystoneResults, schools, districts } from '../db/newSchema';
import path from 'path';
import fs from 'fs/promises';

// Global import progress tracker
export const importProgress = new EventEmitter();

interface ImportStatus {
  isRunning: boolean;
  currentFile?: string;
  currentStep?: string;
  totalFiles?: number;
  processedFiles?: number;
  totalRecords?: number;
  processedRecords?: number;
  errors?: string[];
  startTime?: Date;
  estimatedTimeRemaining?: number;
  progress?: number; // 0-100
}

let currentImportStatus: ImportStatus = {
  isRunning: false,
  progress: 0
};

// Update the global import status
export function updateImportStatus(status: Partial<ImportStatus>) {
  currentImportStatus = { ...currentImportStatus, ...status };
  if (status.processedFiles !== undefined && status.totalFiles) {
    currentImportStatus.progress = Math.round((status.processedFiles / status.totalFiles) * 100);
  }
  importProgress.emit('update', currentImportStatus);
}

const importRoutes: FastifyPluginAsync = async (fastify) => {
  // SSE endpoint for real-time updates
  fastify.get('/status/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial status
    reply.raw.write(`data: ${JSON.stringify(currentImportStatus)}\n\n`);

    // Send updates as they happen
    const updateHandler = (status: ImportStatus) => {
      reply.raw.write(`data: ${JSON.stringify(status)}\n\n`);
    };

    importProgress.on('update', updateHandler);

    // Clean up on disconnect
    request.raw.on('close', () => {
      importProgress.off('update', updateHandler);
    });
  });

  // Get current import status
  fastify.get('/status', async (_request, _reply) => {
    // Add database statistics
    const stats = await getImportStats();
    return {
      ...currentImportStatus,
      stats
    };
  });

  // Start import (example endpoint - you'd trigger your actual import here)
  fastify.post('/start', async (_request, reply) => {
    if (currentImportStatus.isRunning) {
      return reply.status(400).send({ error: 'Import already running' });
    }

    // Start the import in background
    startImportProcess();
    
    return { message: 'Import started', status: currentImportStatus };
  });

  // Cancel import
  fastify.post('/cancel', async (_request, reply) => {
    if (!currentImportStatus.isRunning) {
      return reply.status(400).send({ error: 'No import running' });
    }

    shouldCancelImport = true;
    updateImportStatus({
      currentStep: 'Cancelling import...'
    });

    return { message: 'Import cancellation requested' };
  });
};

async function getImportStats() {
  const [pssaCount] = await db.select({
    count: sql<number>`count(*)`
  }).from(pssaResults);

  const [keystoneCount] = await db.select({
    count: sql<number>`count(*)`
  }).from(keystoneResults);

  const [schoolCount] = await db.select({
    count: sql<number>`count(*)`
  }).from(schools);

  const [districtCount] = await db.select({
    count: sql<number>`count(*)`
  }).from(districts);

  return {
    pssaRecords: pssaCount?.count || 0,
    keystoneRecords: keystoneCount?.count || 0,
    schools: schoolCount?.count || 0,
    districts: districtCount?.count || 0,
    lastUpdate: new Date()
  };
}

// Flag to track if import should be cancelled
let shouldCancelImport = false;

// Real import process
async function startImportProcess() {
  shouldCancelImport = false;
  const importer = new DataImporterFixed();
  const sourcePath = path.join(process.cwd(), '..', 'sources');

  const directories = [
    'pssa/school',
    'pssa/district',
    'pssa/state',
    'keystone/school',
    'keystone/district',
    'keystone/state'
  ];

  try {
    // Count total files first
    let totalFiles = 0;
    for (const dir of directories) {
      const dirPath = path.join(sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        totalFiles += files.filter(f => f.endsWith('.xlsx')).length;
      } catch (error) {
        // Directory might not exist, skip
      }
    }

    updateImportStatus({
      isRunning: true,
      currentStep: 'Initializing import...',
      totalFiles,
      processedFiles: 0,
      totalRecords: 0,
      processedRecords: 0,
      startTime: new Date(),
      errors: []
    });

    let processedFiles = 0;
    let totalProcessed = 0;
    const errors: string[] = [];

    for (const dir of directories) {
      if (shouldCancelImport) {
        updateImportStatus({
          isRunning: false,
          currentStep: 'Import cancelled by user',
          errors
        });
        return;
      }

      const dirPath = path.join(sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx')).sort();

        for (const file of xlsxFiles) {
          if (shouldCancelImport) {
            updateImportStatus({
              isRunning: false,
              currentStep: 'Import cancelled by user',
              errors
            });
            return;
          }

          const filePath = path.join(dirPath, file);

          updateImportStatus({
            currentFile: file,
            currentStep: `Processing ${file}...`,
            processedFiles,
            processedRecords: totalProcessed
          });

          try {
            const result = await importer.importFile(filePath);
            totalProcessed += result.recordsProcessed;

            if (result.errors.length > 0) {
              errors.push(...result.errors.map(e => `${file}: ${e}`));
            }
          } catch (error) {
            const errorMsg = `Error processing ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
          }

          processedFiles++;
          updateImportStatus({
            processedFiles,
            processedRecords: totalProcessed,
            errors
          });
        }
      } catch (error) {
        const errorMsg = `Error reading directory ${dir}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        updateImportStatus({ errors });
      }
    }

    // Import PVAAS growth data (updates existing PSSA/Keystone records)
    if (!shouldCancelImport) {
      updateImportStatus({
        currentStep: 'Importing PVAAS growth data...',
        processedFiles,
        processedRecords: totalProcessed
      });

      try {
        const pvaasImporter = new PVAASImporter();
        await pvaasImporter.importAllPVAASFiles();
      } catch (error) {
        const errorMsg = `PVAAS import error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
      }
    }

    updateImportStatus({
      isRunning: false,
      currentStep: errors.length > 0 ? 'Import completed with errors' : 'Import completed successfully',
      progress: 100,
      processedFiles,
      processedRecords: totalProcessed,
      errors
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateImportStatus({
      isRunning: false,
      currentStep: 'Import failed',
      errors: [...(currentImportStatus.errors || []), errorMsg]
    });
  }
}

export default importRoutes;