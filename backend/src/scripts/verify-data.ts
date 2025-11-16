#!/usr/bin/env tsx

/**
 * Data Verification Script
 *
 * Compares Excel source files with database records to ensure data integrity.
 *
 * Usage:
 *   npm run verify
 *   or
 *   tsx src/scripts/verify-data.ts
 */

import { DataVerifier } from '../services/dataVerifier';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('STARTING DATA VERIFICATION');
  console.log('='.repeat(80) + '\n');

  const verifier = new DataVerifier();

  try {
    // Run verification
    const report = await verifier.verifyAllData();

    // Generate text report
    const textReport = verifier.generateTextReport(report);

    // Print to console
    console.log(textReport);

    // Save report to file
    const reportDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(reportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `verification-report-${timestamp}.txt`);
    await fs.writeFile(reportPath, textReport);

    // Save JSON report
    const jsonReportPath = path.join(reportDir, `verification-report-${timestamp}.json`);
    await fs.writeFile(jsonReportPath, JSON.stringify(report, null, 2));

    console.log(`\nReports saved to:`);
    console.log(`  Text: ${reportPath}`);
    console.log(`  JSON: ${jsonReportPath}`);

    // Exit with appropriate code
    if (report.summary.overallMatch) {
      console.log('\n✅ VERIFICATION PASSED - Data integrity confirmed!\n');
      process.exit(0);
    } else {
      console.log('\n❌ VERIFICATION FAILED - Data discrepancies detected!\n');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Verification failed:', error);
    console.error('\n❌ VERIFICATION ERROR:', error);
    process.exit(1);
  }
}

main();
