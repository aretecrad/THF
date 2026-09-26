"use client";

import { useRef } from "react";
import type { Account } from "@/domain/account";
import { accountStatus, DELETE_DATA_CONFIRMATION } from "../copy";
import { Button } from "./Button";
import styles from "./AccountMenu.module.css";

type Props = {
  account: Account;
  onLogout: () => void;
  onDeleteData: () => void;
};

export function AccountMenu({ account, onLogout, onDeleteData }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");

  function deleteData() {
    close();
    if (window.confirm(DELETE_DATA_CONFIRMATION)) onDeleteData();
  }

  return (
    <details ref={menu} className={styles.menu}>
      <summary className={styles.trigger} aria-label={`Account menu for @${account.username}`}>
        {account.pictureUrl ? (
          <img className={styles.avatar} src={account.pictureUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.avatar} aria-hidden="true">
            {account.username.slice(0, 1).toUpperCase()}
          </span>
        )}
      </summary>
      <div className={styles.popover}>
        <p className={styles.who}>
          <strong>@{account.username}</strong>
          <span>{accountStatus(account)}</span>
        </p>
        <Button variant="quiet" className={styles.item} onClick={() => { close(); onLogout(); }}>
          Log out
        </Button>
        <Button variant="link" className={styles.danger} onClick={deleteData}>
          Delete my data
        </Button>
        <a className={styles.privacy} href="/privacy">
          Privacy
        </a>
      </div>
    </details>
  );
}
