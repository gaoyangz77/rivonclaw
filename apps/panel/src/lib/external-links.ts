import { routeFirstPartyUrl } from "@rivonclaw/core";

function firstPartyWebUrl(path: string): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return routeFirstPartyUrl(`https://www.rivonclaw.com${normalizedPath}`).toString();
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
        return firstPartyWebUrl("/terms");
    },
    /** Privacy Policy page */
    get privacyPolicy() {
        return firstPartyWebUrl("/privacy");
    },
} as const;
