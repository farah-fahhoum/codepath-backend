export interface userRoleForAuthType {
  role: string;
}
export interface adminSafe {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface menteeSafe {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  level: string | null;
  createdAt: Date;
}

export interface menteeDetails {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  bio: string;
  level: string | null;
  codeforcesHandle: string | null;
  createdAt: Date;
}

export interface role {
  id: number;
  title: string;
  createdAt: Date;
}

export interface menteeProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  country: string;
  bio: string;
  createdAt: Date;
}

export type authResponse =
  | "Username not found"
  | "Incorrect password"
  | "Invalid Credentials"
  | "Logged in successfully"
  | "Unauthorized"
  | "Provide a token"
  | "Invalid token"
  | "Forbidden"
  | "User not found";
