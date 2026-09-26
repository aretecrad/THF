"use client";

import { useCallback, useEffect, useState } from "react";
import { parseLoginError, type LoginError } from "@/domain/account";
import { dataDeletedNotice, describeError, LOGIN_ERROR } from "../copy";
import { useSession } from "../hooks/use-session";
import { Dashboard } from "./Dashboard";
import { LoginDialog } from "./LoginDialog";

export function AppShell() {
  const session = useSession();
  const [notice, setNotice] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const loginError = useLoginErrorFromUrl();
  const { deleteMyData } = session;
  const problem = session.error ? describeError(session.error) : loginError ? LOGIN_ERROR[loginError] : null;

  useEffect(() => {
    if (window.location.hash === "#_") window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (session.state.status === "signed-out" && (problem || notice)) setLoginOpen(true);
  }, [session.state.status, problem, notice]);

  const deleteData = useCallback(async () => {
    try {
      setNotice(dataDeletedNotice(await deleteMyData()));
    } catch (error) {
      setNotice(describeError(error));
    }
  }, [deleteMyData]);

  if (session.state.status === "loading") return null;

  const { state } = session;
  return (
    <>
      <Dashboard
        account={state.status === "signed-in" ? state.account : null}
        threadsLoginUrl={session.threadsLoginUrl}
        onLoginRequested={() => setLoginOpen(true)}
        onSessionEnded={() => void session.reload()}
        onLogout={() => void session.logout()}
        onDeleteData={() => void deleteData()}
      />
      {state.status === "signed-out" && (
        <LoginDialog
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          options={state.options}
          threadsLoginUrl={session.threadsLoginUrl}
          problem={problem}
          notice={notice}
        />
      )}
    </>
  );
}

function useLoginErrorFromUrl(): LoginError | null {
  const [loginError, setLoginError] = useState<LoginError | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href);
    setLoginError(parseLoginError(url.searchParams.get("login_error")));
    if (url.searchParams.has("login_error")) {
      url.searchParams.delete("login_error");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);
  return loginError;
}
