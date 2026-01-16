export interface School {
  id: number;
  schoolId: string;
  districtId: string;
  name: string;
  schoolType?: string;
  type?: string;
  schoolNumber?: string;
  gradeRange?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  websiteUrl?: string;
  enrollment?: number;
  isCharter?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  // Joined fields from related tables
  districtName?: string;
  districtAun?: string;
  countyName?: string;
  countyId?: number;
  countyCode?: string;
  // Performance data (when included)
  pssaResults?: any[];
  keystoneResults?: any[];
}

export type SchoolType = 'Elementary' | 'Middle' | 'High' | 'K-12' | 'Career/Technical' | 'Charter' | 'Cyber Charter';

export interface SchoolSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  districtId?: string;
  districtName?: string;
  schoolType?: string;
  isCharter?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  countyId?: number;
  countyName?: string;
}