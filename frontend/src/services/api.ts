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
} from '@shared/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
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
};

export default api;