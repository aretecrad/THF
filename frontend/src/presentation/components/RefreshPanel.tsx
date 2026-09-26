"use client";

import type { Account } from "@/domain/account";
import { progressPercent, type RefreshStatus } from "@/domain/refresh";
import type { SystemStatus } from "@/domain/system";
import { cx } from "../class-names";
import { refreshBlocker, refreshHeadline, refreshNote } from "../copy";
import { Button, ButtonLink } from "./Button";
import { GlassPanel } from "./GlassPanel";
import styles from "./RefreshPanel.module.css";

type Props = {
  className?: string;
  account: Account | null;
  threadsLoginUrl: string;
  status: RefreshStatus;
  system: SystemStatus | null;
  onRefresh: () => void;
};

export function RefreshPanel({ className, account, threadsLoginUrl, status, system, onRefresh }: Props) {
  const blocker = refreshBlocker(account);
  if (blocker) {
    return (
      <GlassPanel className={cx(styles.panel, className)}>
        <span className={styles.status}>{blocker.message}</span>
        <ButtonLink href={threadsLoginUrl}>{blocker.action}</ButtonLink>
      </GlassPanel>
    );
  }

  const running = status.state === "running";
  const note = refreshNote(status);
  return (
    <GlassPanel className={cx(styles.panel, className)}>
      <div className={styles.status} aria-live="polite">
        <span className={cx(status.state === "error" && styles.error)}>{refreshHeadline(status, system)}</span>
        {status.state === "running" && (
          <span
            className={styles.progress}
            role="progressbar"
            aria-label="Refresh progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent(status)}
          >
            <span className={styles.fill} style={{ width: `${progressPercent(status)}%` }} />
          </span>
        )}
        {note && <span className={styles.note}>{note}</span>}
      </div>
      <Button onClick={onRefresh} disabled={running}>
        {running ? "Refreshing…" : "Refresh listings"}
      </Button>
    </GlassPanel>
  );
}
