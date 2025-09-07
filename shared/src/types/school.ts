export interface School {
  id: number;
  schoolId: string;
  districtId: string;
  name: string;
  schoolType?: string;
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
}

export type SchoolType = 'Elementary' | 'Middle' | 'High' | 'K-12' | 'Career/Technical' | 'Charter' | 'Cyber Charter';

export interface SchoolSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  districtId?: string;
  schoolType?: string;
  isCharter?: boolean;
}