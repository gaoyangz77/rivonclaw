import { useTranslation } from "react-i18next";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../api/client.js";
import { EXTERNAL_LINKS } from "../lib/external-links.js";
import { ExternalLinkIcon } from "./icons.js";

export function HelpLink() {
    const { t } = useTranslation();

    return (
        <a
            className="help-link-trigger"
            href={EXTERNAL_LINKS.homepage}
            title={t("common.website")}
            onClick={(event) => {
                event.preventDefault();
                void fetchJson<{ authenticated: boolean }>(clientPath(API["auth.webOpen"]), {
                    method: "POST",
                });
            }}
        >
            <ExternalLinkIcon size={18} />
        </a>
    );
}
