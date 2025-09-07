import { FastifyPluginAsync } from 'fastify';
import { EventEmitter } from 'events';
import { db } from '../db';
import { sql } from 'drizzle-orm';

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
  fastify.get('/status', async (request, reply) => {
    // Add database statistics
    const stats = await getImportStats();
    return {
      ...currentImportStatus,
      stats
    };
  });

  // Start import (example endpoint - you'd trigger your actual import here)
  fastify.post('/start', async (request, reply) => {
    if (currentImportStatus.isRunning) {
      return reply.status(400).send({ error: 'Import already running' });
    }

    // Start the import in background
    startImportProcess();
    
    return { message: 'Import started', status: currentImportStatus };
  });

  // Cancel import
  fastify.post('/cancel', async (request, reply) => {
    if (!currentImportStatus.isRunning) {
      return reply.status(400).send({ error: 'No import running' });
    }

    updateImportStatus({ 
      isRunning: false, 
      currentStep: 'Cancelled by user' 
    });
    
    return { message: 'Import cancelled' };
  });
};

async function getImportStats() {
  const [pssaCount] = await db.select({ 
    count: sql<number>`count(*)` 
  }).from('pssa_results' as any);
  
  const [keystoneCount] = await db.select({ 
    count: sql<number>`count(*)` 
  }).from('keystone_results' as any);
  
  const [schoolCount] = await db.select({ 
    count: sql<number>`count(*)` 
  }).from('schools' as any);
  
  const [districtCount] = await db.select({ 
    count: sql<number>`count(*)` 
  }).from('districts' as any);

  return {
    pssaRecords: pssaCount?.count || 0,
    keystoneRecords: keystoneCount?.count || 0,
    schools: schoolCount?.count || 0,
    districts: districtCount?.count || 0,
    lastUpdate: new Date()
  };
}

// Mock import process for demonstration
async function startImportProcess() {
  updateImportStatus({
    isRunning: true,
    currentStep: 'Initializing import...',
    totalFiles: 20,
    processedFiles: 0,
    startTime: new Date(),
    errors: []
  });

  // Simulate import progress
  const files = [
    '2024-pssa-school-data.xlsx',
    '2023-pssa-school-data.xlsx',
    '2022-pssa-school-data.xlsx',
    '2024-keystone-school-data.xlsx',
    '2023-keystone-school-data.xlsx'
  ];

  for (let i = 0; i < files.length; i++) {
    updateImportStatus({
      currentFile: files[i],
      currentStep: `Processing ${files[i]}...`,
      processedFiles: i + 1,
      processedRecords: (i + 1) * 1000
    });
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  updateImportStatus({
    isRunning: false,
    currentStep: 'Import completed successfully',
    progress: 100
  });
}

export default importRoutes;