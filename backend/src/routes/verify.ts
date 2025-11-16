import { FastifyPluginAsync } from 'fastify';
import { EventEmitter } from 'events';
import { DataVerifier, VerificationReport } from '../services/dataVerifier';

// Global verification progress tracker
export const verificationProgress = new EventEmitter();

interface FileResult {
  fileName: string;
  status: 'pass' | 'fail';
  sourceRowCount: number;
  dbRowCount: number;
  discrepancy: number;
  timestamp: Date;
}

interface VerificationStatus {
  isRunning: boolean;
  currentFile?: string;
  currentStep?: string;
  totalFiles?: number;
  processedFiles?: number;
  filesPassed?: number;
  filesFailed?: number;
  progress?: number; // 0-100
  errors?: string[];
  startTime?: Date;
  report?: VerificationReport;
  fileResults?: FileResult[]; // Track individual file results
}

let currentVerificationStatus: VerificationStatus = {
  isRunning: false,
  progress: 0
};

let shouldCancelVerification = false;

// Update the global verification status
export function updateVerificationStatus(status: Partial<VerificationStatus>) {
  currentVerificationStatus = { ...currentVerificationStatus, ...status };
  if (status.processedFiles !== undefined && status.totalFiles) {
    currentVerificationStatus.progress = Math.round((status.processedFiles / status.totalFiles) * 100);
  }
  verificationProgress.emit('update', currentVerificationStatus);
}

const verifyRoutes: FastifyPluginAsync = async (fastify) => {
  // SSE endpoint for real-time updates
  fastify.get('/status/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial status
    reply.raw.write(`data: ${JSON.stringify(currentVerificationStatus)}\n\n`);

    // Send updates as they happen
    const updateHandler = (status: VerificationStatus) => {
      reply.raw.write(`data: ${JSON.stringify(status)}\n\n`);
    };

    verificationProgress.on('update', updateHandler);

    // Clean up on disconnect
    request.raw.on('close', () => {
      verificationProgress.off('update', updateHandler);
    });
  });

  // Get current verification status
  fastify.get('/status', async (request, reply) => {
    return currentVerificationStatus;
  });

  // Start verification
  fastify.post('/start', async (request, reply) => {
    if (currentVerificationStatus.isRunning) {
      return reply.status(400).send({ error: 'Verification already running' });
    }

    // Start verification in background
    startVerificationProcess();

    return { message: 'Verification started', status: currentVerificationStatus };
  });

  // Cancel verification
  fastify.post('/cancel', async (request, reply) => {
    if (!currentVerificationStatus.isRunning) {
      return reply.status(400).send({ error: 'No verification running' });
    }

    shouldCancelVerification = true;
    updateVerificationStatus({
      currentStep: 'Cancelling verification...'
    });

    return { message: 'Verification cancellation requested' };
  });

  // Get text report (if available)
  fastify.get('/report', async (request, reply) => {
    if (!currentVerificationStatus.report) {
      return reply.status(404).send({ error: 'No verification report available' });
    }

    const verifier = new DataVerifier();
    const textReport = verifier.generateTextReport(currentVerificationStatus.report);

    reply.type('text/plain');
    return textReport;
  });
};

// Real verification process with SSE updates
async function startVerificationProcess() {
  shouldCancelVerification = false;
  const verifier = new DataVerifier();

  updateVerificationStatus({
    isRunning: true,
    currentStep: 'Initializing verification...',
    totalFiles: 0,
    processedFiles: 0,
    filesPassed: 0,
    filesFailed: 0,
    startTime: new Date(),
    errors: [],
    report: undefined,
    fileResults: []
  });

  try {
    // Create a modified verifier that emits progress and checks cancel flag
    const report = await verifier.verifyAllDataWithProgress(
      (update) => {
        // If we have a file result, add it to the results array
        if (update.fileResult) {
          const newResult = {
            ...update.fileResult,
            timestamp: new Date()
          };
          const updatedResults = [...(currentVerificationStatus.fileResults || []), newResult];
          updateVerificationStatus({
            ...update,
            fileResults: updatedResults
          });
        } else {
          updateVerificationStatus(update);
        }
      },
      () => shouldCancelVerification  // Pass cancel checker
    );

    // Check if cancelled
    if (shouldCancelVerification) {
      updateVerificationStatus({
        isRunning: false,
        currentStep: 'Verification cancelled by user',
        progress: currentVerificationStatus.progress || 0
      });
      return;
    }

    updateVerificationStatus({
      isRunning: false,
      currentStep: report.summary.overallMatch
        ? 'Verification completed - All data matches! ✓'
        : 'Verification completed - Discrepancies found ✗',
      progress: 100,
      report,
      totalFiles: report.totalFiles,
      processedFiles: report.filesVerified,
      filesPassed: report.filesPassed,
      filesFailed: report.filesFailed
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    updateVerificationStatus({
      isRunning: false,
      currentStep: 'Verification failed',
      errors: [...(currentVerificationStatus.errors || []), errorMsg]
    });
  }
}

export default verifyRoutes;
