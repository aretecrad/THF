export type RefreshStatus =
  | { readonly state: "idle" }
  | { readonly state: "running"; readonly phase: "searching" | "reading"; readonly done: number; readonly total: number }
  | {
      readonly state: "done";
      readonly finishedAt: Date;
      readonly postsFound: number;
      readonly added: number;
      readonly located: number;
      readonly commentsRead: number;
      readonly geocodeLimitReached: boolean;
      readonly commentLimitReached: boolean;
      readonly commentsError?: string;
    }
  | { readonly state: "error"; readonly message: string };

type RunningRefresh = Extract<RefreshStatus, { state: "running" }>;

export const progressPercent = ({ done, total }: RunningRefresh): number =>
  total === 0 ? 0 : Math.round((done / total) * 100);
