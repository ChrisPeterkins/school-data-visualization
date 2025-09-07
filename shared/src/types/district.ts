export interface District {
  id: number;
  districtId: string;
  name: string;
  county?: string;
  intermediateUnit?: string;
  websiteUrl?: string;
  totalEnrollment?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DistrictSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  county?: string;
}