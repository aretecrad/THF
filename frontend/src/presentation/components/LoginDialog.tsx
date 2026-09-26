"use client";

import { useEffect, useRef } from "react";
import type { LoginOptions } from "@/domain/account";
import { Brand } from "./Brand";
import { Button, ButtonLink } from "./Button";
import { GlassPanel } from "./GlassPanel";
import styles from "./LoginDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  options: LoginOptions;
  threadsLoginUrl: string;
  problem: string | null;
  notice: string | null;
};

export function LoginDialog({ open, onClose, options, threadsLoginUrl, problem, notice }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="login-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <GlassPanel as="section" className={styles.card}>
        <div className={styles.header}>
          <Brand as="p" id="login-title" />
          <Button variant="quiet" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>
        <p className={styles.lede}>Log in with Threads to find houses for sale and rent, ranked by distance from where you need to be.</p>

        {notice && <p className={styles.notice}>{notice}</p>}
        {problem && (
          <p className={styles.problem} role="alert">
            {problem}
          </p>
        )}

        <div className={styles.actions}>
          {options.threads ? (
            <ButtonLink href={threadsLoginUrl} className={styles.action} autoFocus>
              Continue with Threads
            </ButtonLink>
          ) : (
            <Button className={styles.action} disabled>
              Continue with Threads
            </Button>
          )}
        </div>

        {!options.threads && !problem && (
          <p className={styles.setup}>
            To turn on Threads login, add <code>THREADS_APP_ID</code> and <code>THREADS_APP_SECRET</code> to{" "}
            <code>backend/.env</code>.
          </p>
        )}
        <p className={styles.fineprint}>
          The app searches public Threads posts using your account. It never posts, likes or messages for you.{" "}
          <a href="/privacy">Privacy and data deletion</a>
        </p>
      </GlassPanel>
    </dialog>
  );
}
