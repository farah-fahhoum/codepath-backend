export interface NearbyMentee {
  userId: string;
  username: string;
  fullName: string | null;
  country: string | null;
  city: string | null;
  organization: string | null;
  rating: number | null;
  accuracy: number | null;
  problemsSolved: number | null;
  level: string | null;
  similarityScore: number;
}
