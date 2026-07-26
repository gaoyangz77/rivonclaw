import { useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { apolloClient } from "./api/client.js";
import { setAccessToken } from "./api/auth-session.js";
import { EXPERT_BOOTSTRAP, WEB_LOGOUT, WEB_REFRESH } from "./api/operations.js";
import { useExpertStore } from "./store/context.js";
import { AuthScreen } from "./AuthScreen.js";
import { Onboarding } from "./Onboarding.js";
import { ExpertWorkspace } from "./ExpertWorkspace.js";

interface BootstrapData {
  expertProfile: unknown;
  expertConversations: {
    items: Array<{ id: string; title: string; lastMessageAt: string }>;
  };
  expertUsageStatus: {
    mode: string;
    freeRemaining?: number | null;
    freeLimit?: number | null;
    weeklyTokenRemaining?: number | null;
    fiveHourTokenRemaining?: number | null;
    resetsAt: string;
  };
  activeExpertKnowledgeRelease?: { version: string } | null;
}

export const App = observer(function App() {
  const store = useExpertStore();
  const restored = useRef(false);

  const reloadBootstrap = useCallback(async () => {
    const result = await apolloClient.query<BootstrapData>({
      query: EXPERT_BOOTSTRAP,
      fetchPolicy: "network-only",
    });
    if (!result.data) return;
    store.applyBootstrap({
      profile: result.data.expertProfile,
      conversations: result.data.expertConversations.items,
      usage: result.data.expertUsageStatus,
      knowledgeVersion: result.data.activeExpertKnowledgeRelease?.version,
    });
  }, [store]);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    void (async () => {
      try {
        const result = await apolloClient.mutate<{
          webRefresh: { accessToken: string; user: { email: string } };
        }>({ mutation: WEB_REFRESH });
        const payload = result.data?.webRefresh;
        if (!payload) throw new Error("No browser session");
        setAccessToken(payload.accessToken);
        store.finishBoot(true, payload.user.email);
      } catch {
        setAccessToken(null);
        store.finishBoot(false);
      }
    })();
  }, [store]);

  useEffect(() => {
    if (store.authenticated) void reloadBootstrap();
  }, [reloadBootstrap, store.authenticated]);

  async function logout() {
    try {
      await apolloClient.mutate({ mutation: WEB_LOGOUT });
    } finally {
      setAccessToken(null);
      await apolloClient.clearStore();
      store.signOut();
    }
  }

  if (store.booting) {
    return (
      <main className="boot-screen">
        <div className="brand-mark">R</div>
        <p>Loading your Expert…</p>
      </main>
    );
  }
  if (!store.authenticated) return <AuthScreen />;
  if (!store.hasProfile) return <Onboarding />;
  return <ExpertWorkspace reloadBootstrap={reloadBootstrap} logout={logout} />;
});
