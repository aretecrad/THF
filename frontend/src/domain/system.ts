export interface SystemStatus {
  readonly threadsConnected: boolean;
  readonly listings: number;
  readonly located: number;
  readonly lastRefreshedAt?: Date;
}
