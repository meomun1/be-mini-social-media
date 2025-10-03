// Database-related types for migrations and seeders

export interface MigrationInfo {
  id: string;
  name: string;
  appliedAt: Date;
  checksum: string;
}

export interface SeederInfo {
  id: string;
  name: string;
  executedAt: Date;
  dataCount: number;
}

export interface MigrationStatus {
  total: number;
  applied: number;
  pending: number;
  lastApplied?: string;
}

export interface SeederStatus {
  total: number;
  executed: number;
  pending: number;
  lastExecuted?: string;
}
