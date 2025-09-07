import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  JWT_SECRET: z.string().optional(),
  URBAN_INSTITUTE_API_URL: z.string().default('https://educationdata.urban.org/api/v1'),
  URBAN_INSTITUTE_API_KEY: z.string().optional(),
});

const parseConfig = () => {
  const parsed = configSchema.safeParse(process.env);
  
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten());
    process.exit(1);
  }
  
  return parsed.data;
};

export const config = parseConfig();
export type Config = typeof config;