import { getFirstPartyDomainRoute } from "@rivonclaw/core";

const GLOBAL_WEBSITE_ORIGIN = "https://www.tkcopilot.com";
const CN_WEBSITE_ORIGIN = "https://www.tkjiang.cn";

function firstPartyWebUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const origin =
        getFirstPartyDomainRoute() === "cn-relay"
            ? CN_WEBSITE_ORIGIN
            : GLOBAL_WEBSITE_ORIGIN;
    return new URL(normalizedPath, origin).toString();
}

/**
 * Centralized external links configuration.
 * All outbound URLs should be managed here for easy maintenance.
 */
export const EXTERNAL_LINKS = {
    /** Project homepage / GitHub repo */
    get homepage() {
        return firstPartyWebUrl("/");
    },
    /** Terms of Service page */
    get termsOfService() {
        return firstPartyWebUrl("/terms/");
    },
    /** Privacy Policy page */
    get privacyPolicy() {
        return firstPartyWebUrl("/privacy");
    },
} as const;
