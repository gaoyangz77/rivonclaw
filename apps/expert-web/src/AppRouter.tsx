import { Navigate, Route, Routes } from "react-router-dom";
import { App } from "./App.js";
import { AccountLoginPage } from "./AccountLoginPage.js";
import { DesktopLoginPage } from "./DesktopLoginPage.js";
import { TikTokOAuthCallbackPage } from "./TikTokOAuthCallbackPage.js";
import { TikTokOAuthStartPage } from "./TikTokOAuthStartPage.js";

/**
 * Authenticated browser surfaces share one route table and one www session.
 * Account, OAuth, and shop-claim routes are added here in later rollout gates.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/expert/*" element={<App />} />
      <Route path="/account/login" element={<AccountLoginPage />} />
      <Route path="/account/register" element={<AccountLoginPage register />} />
      <Route path="/account/desktop-login" element={<DesktopLoginPage />} />
      <Route path="/oauth/tiktok/start" element={<TikTokOAuthStartPage />} />
      <Route
        path="/oauth/tiktok/callback/:serviceId"
        element={<TikTokOAuthCallbackPage />}
      />
      <Route path="*" element={<Navigate to="/expert" replace />} />
    </Routes>
  );
}
