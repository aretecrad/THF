export interface User {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
  readonly pictureUrl?: string;
  readonly createdAt: Date;
}
