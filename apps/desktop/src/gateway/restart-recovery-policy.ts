/** Keep startup session convergence and Gateway replay on the same host policy. */
export const DESKTOP_RESTART_RECOVERY_ENV = {
  // Backend/Airflow owns CS retries; replaying interrupted local work can
  // overload the Gateway. Startup must retire its orphaned running sessions.
  OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY: "1",
  OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY: "1",
} as const;
