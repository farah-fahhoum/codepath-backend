export interface contactInfoType {
  id: number;
  email: string;
  phone: string;
  facebook: string;
  instagram: string;
  youtube: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface contactInquirySafe {
  id: number;
  fullName: string;
  title: string;
  createdAt: Date;
}

export interface contactInquiryDetails {
  id: number;
  fullName: string;
  email: string;
  title: string;
  message: string;
  createdAt: Date;
}
