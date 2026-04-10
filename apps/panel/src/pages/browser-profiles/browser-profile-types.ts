import { DEFAULTS } from "@rivonclaw/core";

export interface BrowserProfileFormState {
  name: string;
  proxyEnabled: boolean;
  proxyBaseUrl: string;
  tags: string;
  notes: string;
  status: string;
  sessionEnabled: boolean;
  sessionCheckpointIntervalSec: number;
  sessionStorage: "local" | "cloud";
}

export const EMPTY_FORM: BrowserProfileFormState = {
  name: "",
  proxyEnabled: false,
  proxyBaseUrl: "",
  tags: "",
  notes: "",
  status: "active",
  sessionEnabled: true,
  sessionCheckpointIntervalSec: DEFAULTS.browserProfiles.defaultCheckpointIntervalSec,
  sessionStorage: "local",
};
