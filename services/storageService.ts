
export interface StudentProfile {
  id: string;
  name: string;
}

export interface StudentProfileData {
  id: string;
  data: any;
}

export const uploadFile = async () => ({ data: { path: '' }, error: null });
export const getPublicUrl = () => ({ data: { publicUrl: '' } });
