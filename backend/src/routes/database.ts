import { FastifyPluginAsync } from 'fastify';
import { db } from '../db';
import { pssaResults, keystoneResults, schools, districts } from '../db/newSchema';
import { sql } from 'drizzle-orm';

const databaseRoutes: FastifyPluginAsync = async (fastify) => {

  // Get list of all tables
  fastify.get('/tables', async () => {
    const tables = [
      { name: 'pssa_results', label: 'PSSA Results', recordCount: 0 },
      { name: 'keystone_results', label: 'Keystone Results', recordCount: 0 },
      { name: 'schools', label: 'Schools', recordCount: 0 },
      { name: 'districts', label: 'Districts', recordCount: 0 },
    ];

    // Get record counts for each table
    try {
      const [pssaCount] = await db.select({ count: sql<number>`count(*)` }).from(pssaResults);
      tables[0].recordCount = Number(pssaCount.count);

      const [keystoneCount] = await db.select({ count: sql<number>`count(*)` }).from(keystoneResults);
      tables[1].recordCount = Number(keystoneCount.count);

      const [schoolsCount] = await db.select({ count: sql<number>`count(*)` }).from(schools);
      tables[2].recordCount = Number(schoolsCount.count);

      const [districtsCount] = await db.select({ count: sql<number>`count(*)` }).from(districts);
      tables[3].recordCount = Number(districtsCount.count);
    } catch (error) {
      fastify.log.error({ err: error }, 'Error getting table counts');
    }

    return tables;
  });

  // Get table schema/columns
  fastify.get('/schema/:tableName', async (request, reply) => {
    const { tableName } = request.params as { tableName: string };

    if (!['pssa_results', 'keystone_results', 'schools', 'districts'].includes(tableName)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }

    try {
      // Query SQLite schema
      const schemaQuery = sql.raw(`PRAGMA table_info(${tableName})`);
      const columns = await db.all(schemaQuery) as any[];

      return columns.map(col => ({
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value,
        primaryKey: col.pk === 1
      }));
    } catch (error) {
      fastify.log.error({ err: error }, 'Error getting schema');
      return reply.status(500).send({ error: 'Failed to get table schema' });
    }
  });

  // Get table data with pagination
  fastify.get('/data/:tableName', async (request, reply) => {
    const { tableName } = request.params as { tableName: string };
    const { page = '1', limit = '100', sortBy, sortOrder = 'asc' } = request.query as {
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    if (!['pssa_results', 'keystone_results', 'schools', 'districts'].includes(tableName)) {
      return reply.status(400).send({ error: 'Invalid table name' });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      let table;
      switch (tableName) {
        case 'pssa_results':
          table = pssaResults;
          break;
        case 'keystone_results':
          table = keystoneResults;
          break;
        case 'schools':
          table = schools;
          break;
        case 'districts':
          table = districts;
          break;
        default:
          return reply.status(400).send({ error: 'Invalid table name' });
      }

      // Get total count
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(table);
      const totalRecords = Number(countResult.count);

      // Build query with pagination
      const baseQuery = db.select().from(table).limit(limitNum).offset(offset);

      // Add sorting if specified
      let data;
      if (sortBy && table[sortBy as keyof typeof table]) {
        const column = table[sortBy as keyof typeof table];
        const sortedQuery = sortOrder === 'desc'
          ? baseQuery.orderBy(sql`${column} DESC`)
          : baseQuery.orderBy(sql`${column} ASC`);
        data = await sortedQuery;
      } else {
        data = await baseQuery;
      }

      return {
        tableName,
        data,
        page: pageNum,
        limit: limitNum,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limitNum)
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Error querying table');
      return reply.status(500).send({ error: 'Failed to query table' });
    }
  });

  // Execute custom SQL query (read-only)
  fastify.post('/query', async (request, reply) => {
    const { query } = request.body as { query: string };

    if (!query) {
      return reply.status(400).send({ error: 'Query is required' });
    }

    // Security: only allow SELECT statements
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
      return reply.status(400).send({ error: 'Only SELECT queries are allowed' });
    }

    // Prevent dangerous operations
    const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE'];
    if (dangerousKeywords.some(keyword => trimmedQuery.includes(keyword))) {
      return reply.status(400).send({ error: 'Query contains forbidden keywords' });
    }

    try {
      const results = await db.all(sql.raw(query));
      return {
        query,
        results,
        rowCount: results.length
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Error executing query');
      return reply.status(500).send({
        error: 'Query execution failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
};

export default databaseRoutes;
