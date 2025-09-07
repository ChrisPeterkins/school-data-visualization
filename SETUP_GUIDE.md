# Complete Setup Guide for New Environment

This guide will help you set up the Pennsylvania School Data Visualization application from scratch in a new environment, including all data imports and configurations.

## 📋 Prerequisites

Ensure you have the following installed:
- **Node.js 18+** (check with `node --version`)
- **npm 9+** (check with `npm --version`)
- **Git** (check with `git --version`)
- **At least 2GB free disk space** for database and data files

## 🚀 Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ChrisPeterkins/school-data-visualization.git
cd school-data-visualization
```

### 2. Install Dependencies

```bash
# Install root workspace dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

### 3. Set Up Environment Variables

```bash
# Navigate to backend
cd backend

# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=./school-data.db
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
LOG_LEVEL=info
EOF
```

### 4. Download Source Data Files

The application needs Excel files from PA Department of Education. They should be in the `sources/` directory:

```
sources/
├── pssa/
│   ├── school/
│   │   ├── 2015 pssa school level data.xlsx
│   │   ├── 2016 pssa school level data.xlsx
│   │   ├── ... (through 2023)
│   │   └── 2024-pssa-school-data.xlsx
│   ├── district/
│   │   └── [district level files]
│   └── state/
│       └── [state level files]
└── keystone/
    ├── school/
    │   └── [school level files]
    ├── district/
    │   └── [district level files]
    └── state/
        └── [state level files]
```

**Note**: These files are already included in the repository.

### 5. Initialize and Import Data

This is the most important step - it creates the database and imports all school data:

```bash
# From backend directory
cd backend

# Run the comprehensive data import
npx tsx src/scripts/runNewImport.ts

# This will:
# - Create the SQLite database
# - Import all counties and districts
# - Import all schools
# - Import PSSA results (2015-2024)
# - Import Keystone results (2015-2024)
# - Process demographic breakdowns
```

**Expected output:**
- Import will take 5-10 minutes
- You'll see progress messages for each file
- Database file `school-data.db` will be created (~350MB)

### 6. Verify Database Import

```bash
# Check record counts
sqlite3 school-data.db << 'EOF'
SELECT 'Schools' as type, COUNT(*) as count FROM schools
UNION ALL
SELECT 'Districts', COUNT(*) FROM districts
UNION ALL
SELECT 'PSSA Results', COUNT(*) FROM pssa_results
UNION ALL
SELECT 'Keystone Results', COUNT(*) FROM keystone_results;
EOF
```

You should see:
- ~3000+ schools
- ~500+ districts
- ~500,000+ PSSA results
- ~200,000+ Keystone results

### 7. Start Development Servers

Open two terminal windows:

**Terminal 1 - Backend Server:**
```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 3000
```

**Terminal 2 - Frontend Server:**
```bash
cd frontend
npm run dev
```

You should see:
```
VITE ready at http://localhost:5173
```

### 8. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **API Health Check**: http://localhost:3000/api/health
- **Import Progress**: http://localhost:5173/import

### 9. Test Key Features

1. **Search for a school**: Try "Churchville" in the search box
2. **View school details**: Click on any school to see performance data
3. **Change years**: Use the year selector to view historical data
4. **Check import status**: Navigate to `/import` to see database statistics

## 🔧 Troubleshooting

### Database Issues

If the database is corrupted or you need to re-import:

```bash
cd backend

# Backup existing database (if needed)
mv school-data.db school-data.backup.db

# Re-run import
npx tsx src/scripts/runNewImport.ts
```

### Port Conflicts

If ports 3000 or 5173 are in use:

```bash
# Change backend port in backend/.env
PORT=3001

# Change frontend port
cd frontend
npm run dev -- --port 5174
```

### Import Errors

If import fails:
1. Check that Excel files exist in `sources/` directory
2. Ensure you have write permissions in `backend/` directory
3. Check available disk space (need ~500MB free)

### Missing Dependencies

If you get module not found errors:

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json

# Reinstall everything
npm install
cd backend && npm install
cd ../frontend && npm install
```

## 📝 Important Files & Directories

### Database
- `backend/school-data.db` - Main SQLite database
- `backend/src/db/schema.ts` - Database schema definition
- `backend/src/db/newSchema.ts` - Updated schema with relationships

### Import Scripts
- `backend/src/scripts/runNewImport.ts` - Main import script
- `backend/src/services/newDataImporter.ts` - Import service with column mappings
- `backend/src/scripts/importWithProgress.ts` - Import with progress tracking

### Key Components
- `frontend/src/pages/SchoolDetailPage.tsx` - School details with year selector
- `frontend/src/pages/ImportProgressPage.tsx` - Real-time import progress
- `backend/src/routes/import.ts` - Import API endpoints

## 🎯 Current State & Features

As of the last update, the application includes:

✅ **Completed Features:**
- School search and filtering
- PSSA/Keystone data display
- Year selector (2015-2024)
- Real-time import progress tracking
- Database with all PA school data
- Performance visualizations
- District and state aggregations

🚧 **In Progress:**
- Performance optimizations
- Additional data visualizations
- Comparison tools refinement

## 💡 Tips for Development

1. **Use the import progress page** (`/import`) to monitor data imports
2. **Check the year selector** on school detail pages to verify historical data
3. **Database is SQLite** - use any SQLite browser to inspect data
4. **Hot reload is enabled** - changes auto-refresh in development
5. **API docs** available at endpoints listed in README

## 🔄 Updating Data

To update with new data files:

1. Add new Excel files to appropriate `sources/` subdirectory
2. Update column mappings in `backend/src/services/newDataImporter.ts` if format changed
3. Run import script: `npx tsx src/scripts/runNewImport.ts`

## 📦 Production Deployment

For production deployment:

```bash
# Build frontend
cd frontend
npm run build
# Output in frontend/dist/

# Build backend
cd ../backend
npm run build
# Output in backend/dist/

# Set production environment
export NODE_ENV=production

# Start production server
npm run start
```

## 🆘 Getting Help

- Check existing issues: https://github.com/ChrisPeterkins/school-data-visualization/issues
- Review import logs in terminal output
- Database queries can be tested directly with SQLite CLI

---

**Note**: This setup creates a fully functional development environment with all Pennsylvania school data from 2015-2024. The database will be approximately 350MB after import.