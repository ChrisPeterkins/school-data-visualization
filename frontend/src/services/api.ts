import axios from 'axios';
import type { 
  School, 
  District, 
  PSSAResult, 
  KeystoneResult, 
  ApiResponse,
  SchoolSearchParams,
  DistrictSearchParams,
  SchoolPerformanceTrends
} from '@shared';

export interface SummaryPoint {
  year: number;
  tested: number;
  rows: number;
  entities: number;
  proficiency: number | null;
  advanced: number | null;
  proficient: number | null;
  basic: number | null;
  belowBasic: number | null;
  growth: number | null;
  growthRows: number;
}

export interface GrowthPoint {
  schoolId: number;
  schoolName: string;
  schoolType: string | null;
  districtName: string;
  proficiency: number;
  growth: number;
  tested: number;
}

export interface DataStatus {
  generatedAt: string;
  years: Array<{
    year: number;
    pssa: LevelCounts;
    keystone: LevelCounts;
    flags: string[];
  }>;
  duplicates: { pssa: number; keystone: number };
  nonCanonicalGroups: string[];
  flags: string[];
}

export interface LevelCounts {
  school: number;
  district: number;
  state: number;
  growthCoverage: number | null;
  suppressedShare: number | null;
  subjects: string[];
}

const api = axios.create({
  baseURL: '/paschools',
  timeout: 30000,
});

export const schoolApi = {
  getSchools: async (params?: SchoolSearchParams) => {
    const { data } = await api.get<ApiResponse<School[]>>('/api/schools', { params });
    return data;
  },

  getSchool: async (id: string) => {
    const { data } = await api.get<School>(`/api/schools/${id}`);
    return data;
  },

  getSimilar: async (id: string, limit = 4) => {
    const { data } = await api.get<{ schoolId: number; similar: SimilarSchool[] }>(`/api/schools/${id}/similar`, { params: { limit } });
    return data.similar;
  },

  getMapPoints: async (params: { year: number; exam: 'pssa' | 'keystone'; subject: string }) => {
    const { data } = await api.get<{ filters: any; points: MapPoint[] }>('/api/schools/map', { params });
    return data.points;
  },
};

export interface GapGroup { group: string; proficiency: number | null; tested: number; growth: number | null; gap: number | null }
export interface GapsResponse {
  filters: any;
  year: number | undefined;
  years: number[];
  allStudents: number | null;
  groups: GapGroup[];
  trend: Array<{ year: number; group: string; proficiency: number; tested: number }>;
}
export interface SimilarSchool {
  id: number; name: string; type: string | null; city: string | null; districtName: string; countyName: string;
  enrollment: number | null; distanceKm: number | null; lat: number | null; lng: number | null;
}
export interface MapPoint {
  id: number; name: string; lat: number; lng: number; type: string | null; enrollment: number | null;
  districtName: string; countyId: number; proficiency: number | null; growth: number | null; tested: number | null;
}
export interface CountySummary { id: number; name: string; code: string; districtCount: number; schoolCount: number; enrollment: number | null }
export interface CountyDetail extends Omit<CountySummary, 'districtCount' | 'schoolCount' | 'enrollment'> {
  districts: Array<{ id: number; name: string; enrollment: number | null; city: string | null; schoolCount: number }>;
}

export const countyApi = {
  getCounties: async () => {
    const { data } = await api.get<{ data: CountySummary[] }>('/api/counties');
    return data.data;
  },
  getCounty: async (id: string) => {
    const { data } = await api.get<CountyDetail>(`/api/counties/${id}`);
    return data;
  },
};

export const districtApi = {
  getDistricts: async (params?: DistrictSearchParams) => {
    const { data } = await api.get<ApiResponse<District[]>>('/api/districts', { params });
    return data;
  },

  getDistrict: async (id: string) => {
    const { data } = await api.get<District>(`/api/districts/${id}`);
    return data;
  },
};

export const performanceApi = {
  getAvailableYears: async () => {
    const { data } = await api.get<import('../hooks/useAvailableYears').AvailableYears>('/api/performance/years');
    return data;
  },

  getPSSAResults: async (params: any) => {
    const { data } = await api.get<PSSAResult[]>('/api/performance/pssa', { params });
    return data;
  },

  getKeystoneResults: async (params: any) => {
    const { data } = await api.get<KeystoneResult[]>('/api/performance/keystone', { params });
    return data;
  },

  getTrends: async (schoolId: string) => {
    const { data } = await api.get<SchoolPerformanceTrends>(`/api/performance/trends/${schoolId}`);
    return data;
  },

  /** Student-weighted yearly series; see backend /summary for the grade rule. */
  getSummary: async (params: {
    exam: 'pssa' | 'keystone';
    level: 'school' | 'district' | 'state';
    subject?: string;
    grade?: number;
    schoolId?: number;
    districtId?: number;
    countyId?: number;
    yearFrom?: number;
    yearTo?: number;
  }) => {
    const { data } = await api.get<{ filters: any; series: SummaryPoint[] }>('/api/performance/summary', { params });
    return data;
  },

  getGrowthAchievement: async (params: {
    year: number;
    examType: 'pssa' | 'keystone';
    subject?: string;
    grade?: number;
    countyId?: number;
    schoolType?: string;
    minTested?: number;
  }) => {
    const { data } = await api.get<{ filters: any; points: GrowthPoint[] }>('/api/performance/growth-achievement', { params });
    return data;
  },

  getGaps: async (params: {
    exam: 'pssa' | 'keystone';
    level: 'school' | 'district' | 'state';
    subject: string;
    year?: number;
    schoolId?: number;
    districtId?: number;
    countyId?: number;
  }) => {
    const { data } = await api.get<GapsResponse>('/api/performance/gaps', { params });
    return data;
  },

  getDataStatus: async () => {
    const { data } = await api.get<DataStatus>('/api/performance/data-status');
    return data;
  },

  getStatePerformance: async (year?: number) => {
    const params = year ? { year } : {};
    const { data } = await api.get('/api/performance/state', { params });
    return data;
  },

  compareEntities: async (params: {
    entityIds: number[];
    entityType: 'school' | 'district';
    year?: number;
    testType?: 'pssa' | 'keystone' | 'both';
  }) => {
    const { data } = await api.post('/api/performance/compare', params);
    return data;
  },

  getRankings: async (params: {
    year: number;
    examType: 'pssa' | 'keystone';
    subject?: string;
    grade?: number;
    countyId?: number;
    schoolType?: string;
    demographicGroup?: string;
    limit?: number;
    minTested?: number;
  }) => {
    const { data } = await api.get('/api/performance/rankings', { params });
    return data as {
      filters: any;
      top: Array<{
        rank: number;
        schoolId: number;
        schoolName: string;
        schoolType: string | null;
        districtName: string;
        countyName: string;
        city: string | null;
        avgProficiency: number;
        totalTested: number;
        subjectCount: number;
        avgGrowth: number | null;
      }>;
      bottom: Array<{
        rank: number;
        schoolId: number;
        schoolName: string;
        schoolType: string | null;
        districtName: string;
        countyName: string;
        city: string | null;
        avgProficiency: number;
        totalTested: number;
        subjectCount: number;
        avgGrowth: number | null;
      }>;
      stateAverage: number | null;
    };
  },
};

export default api;