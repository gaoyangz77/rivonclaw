import { useTranslation } from "react-i18next";
import { EXTERNAL_LINKS } from "../lib/external-links.js";
import { ExternalLinkIcon } from "./icons.js";

export function HelpLink() {
    const { t } = useTranslation();

    return (
        <a
            className="help-link-trigger"
            href={EXTERNAL_LINKS.homepage}
            target="_blank"
            rel="noopener noreferrer"
            title={t("common.website")}
        >
            <ExternalLinkIcon size={18} />
        </a>
    );
}
