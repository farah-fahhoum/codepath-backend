export interface externalAccount {
  id: number;
  platform: string;
  handle: string;
  lastSynced: Date | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
