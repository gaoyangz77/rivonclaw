import { useTranslation } from "react-i18next";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../api/client.js";
import { EXTERNAL_LINKS } from "../lib/external-links.js";
import { HomeIcon } from "./icons.js";

export function HelpLink() {
    const { t } = useTranslation();

    return (
        <a
            className="sidebar-action-trigger sidebar-action-tooltip help-link-trigger"
            href={EXTERNAL_LINKS.homepage}
            data-tooltip={t("common.openWebsite")}
            aria-label={t("common.openWebsite")}
            onClick={(event) => {
                event.preventDefault();
                void fetchJson<{ authenticated: boolean }>(clientPath(API["auth.webOpen"]), {
                    method: "POST",
                });
            }}
        >
            <HomeIcon size={18} />
        </a>
    );
}
