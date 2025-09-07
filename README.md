# Pennsylvania School Data Visualization Platform

A comprehensive web application for visualizing and analyzing Pennsylvania public school performance data.

## Features

- 📊 Interactive visualizations of PSSA and Keystone exam results
- 🏫 Search and filter schools by district, type, and performance
- 📈 Trend analysis across years (2015-2024)
- 🗺️ Geographic mapping of schools and districts
- 📱 Mobile-responsive design
- ⚡ Fast performance with Redis caching

## Tech Stack

- **Backend**: Node.js, Fastify, PostgreSQL, Drizzle ORM, Redis
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Visualization**: Recharts, Leaflet, TanStack Table
- **Infrastructure**: Docker, PM2, Nginx

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm 10+

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd school-data-visualization
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the database and cache**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate -w backend
   ```

6. **Import data**
   ```bash
   npm run data:import -w backend
   ```

7. **Start development servers**
   ```bash
   npm run dev
   ```

   - Backend API: http://localhost:3000
   - Frontend: http://localhost:5173

## Project Structure

```
├── backend/           # Fastify API server
│   ├── src/
│   │   ├── db/       # Database schema and connections
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── utils/    # Utilities
├── frontend/          # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── services/
├── shared/           # Shared types and utilities
├── sources/          # Source data files
│   ├── pssa/
│   └── keystone/
└── docs/            # Documentation
```

## Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build all packages for production
- `npm run test` - Run tests
- `npm run lint` - Lint code
- `npm run typecheck` - Check TypeScript types

## Data Sources

- Pennsylvania Department of Education (PSSA & Keystone results)
- Urban Institute Education Data Portal (supplementary data)
- Data covers 2015-2024 (excluding 2020 due to COVID-19)

## API Documentation

### Endpoints

- `GET /api/health` - Health check
- `GET /api/schools` - List schools with pagination and filters
- `GET /api/schools/:id` - Get school details
- `GET /api/districts` - List districts
- `GET /api/performance/pssa` - PSSA results
- `GET /api/performance/keystone` - Keystone results
- `GET /api/performance/trends/:schoolId` - School performance trends

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Pennsylvania Department of Education for providing public school data
- Urban Institute for supplementary education data
- Open source community for the amazing tools and libraries