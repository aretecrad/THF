"use client";

import { useCallback, useEffect, useState } from "react";
import type { Account, LoginOptions } from "@/domain/account";
import { useServices } from "../services";

type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "signed-out"; readonly options: LoginOptions }
  | { readonly status: "signed-in"; readonly account: Account };

const NO_LOGIN: LoginOptions = { threads: false };

export function useSession() {
  const { auth } = useServices();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    try {
      const account = await auth.currentAccount();
      setState(account ? { status: "signed-in", account } : { status: "signed-out", options: await auth.options() });
      setError(null);
    } catch (reason) {
      setError(reason);
      setState({ status: "signed-out", options: NO_LOGIN });
    }
  }, [auth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const logout = useCallback(async () => {
    await auth.logout().catch(() => undefined);
    await reload();
  }, [auth, reload]);

  const deleteMyData = useCallback(async () => {
    const { confirmationCode } = await auth.deleteMyData();
    await reload();
    return confirmationCode;
  }, [auth, reload]);

  return { state, error, threadsLoginUrl: auth.threadsLoginUrl, reload, logout, deleteMyData };
}
