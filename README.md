# Pennsylvania School Data Visualization

A comprehensive web application for visualizing and analyzing Pennsylvania school performance data from PSSA and Keystone exams.

## 🚀 Live Features

- **School Search & Browsing**: Search and filter schools by name, district, or county
- **Performance Data Visualization**: View PSSA and Keystone exam results with interactive charts
- **Historical Data**: Year selector to view performance trends from 2015-2024
- **Comparison Tools**: Compare performance across schools and districts
- **Real-time Import Progress**: Visual tracking of data import operations
- **State-level Analytics**: Aggregate performance data at state level

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **TanStack Query** for data fetching and caching
- **React Router v6** for navigation
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Axios** for API requests

### Backend
- **Node.js** with TypeScript
- **Fastify** web framework
- **SQLite** database with Better-SQLite3
- **Drizzle ORM** for database operations
- **Zod** for schema validation
- **XLSX** for Excel file parsing
- **Server-Sent Events** for real-time updates

### Development Tools
- **TSX** for TypeScript execution
- **ESLint** for code quality
- **Git** for version control

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── db/            # Database schemas
│   │   ├── scripts/        # Import and utility scripts
│   │   └── index.ts        # Server entry point
│   └── *.db               # SQLite databases
├── frontend/
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── services/       # API services
│   │   └── App.tsx         # Main app component
│   └── index.html
├── sources/                # Excel data files
│   ├── pssa/
│   └── keystone/
└── shared/                 # Shared TypeScript types
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ChrisPeterkins/school-data-visualization.git
cd school-data-visualization
```

2. **Install dependencies**
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. **Set up environment variables**
```bash
# In backend directory
cp .env.example .env
# Edit .env with your configuration
```

4. **Import data**
```bash
cd backend
npx tsx src/scripts/runNewImport.ts
```

5. **Start development servers**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

6. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Import Progress: http://localhost:5173/import

## 📊 Data Sources

Data is sourced from the Pennsylvania Department of Education:
- PSSA Results (2015-2024) - Grades 3-8
- Keystone Exam Results (2015-2024) - High School
- School and District Information

## 🔧 Available Scripts

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npx tsx src/scripts/runNewImport.ts` - Run full data import
- `npx tsx src/scripts/importWithProgress.ts` - Import with progress tracking

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📝 API Endpoints

### Schools
- `GET /api/schools` - List schools with filtering
- `GET /api/schools/:id` - Get school details with performance data

### Districts
- `GET /api/districts` - List districts
- `GET /api/districts/:id` - Get district details

### Performance
- `GET /api/performance/pssa` - PSSA results
- `GET /api/performance/keystone` - Keystone results
- `GET /api/performance/trends/:schoolId` - Historical trends
- `POST /api/performance/compare` - Compare entities

### Import
- `GET /api/import/status` - Current import status
- `GET /api/import/status/stream` - Real-time updates (SSE)
- `POST /api/import/start` - Start import
- `POST /api/import/cancel` - Cancel import

## 🌟 Key Features

### Year Selector
Navigate through historical data from 2015-2024 on school detail pages.

### Import Progress Tracking
Real-time visual feedback during data imports with:
- Progress bars and percentages
- Current file being processed
- Database statistics
- Error reporting

### Performance Visualization
- Color-coded proficiency levels
- Trend charts over time
- Demographic breakdowns
- Subject-specific results

## 🚢 Deployment

### Production Build
```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd ../backend
npm run build
```

### Environment Variables
Configure these in production:
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Set to 'production'
- `CORS_ORIGIN` - Frontend URL
- `DATABASE_URL` - SQLite database path

## 📄 License

MIT

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 🐛 Known Issues

- Large data imports may take 5-10 minutes
- Database locks during active imports
- Some schools may have incomplete historical data

## 📞 Support

For issues and questions, please use the GitHub issue tracker.

---

Built with ❤️ for Pennsylvania education data transparency