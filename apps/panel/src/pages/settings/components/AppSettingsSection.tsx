import { useTranslation } from "react-i18next";
import { TkSection, TkSwitch } from "../../../components/design-system/index.js";

interface AppSettingsSectionProps {
  accentColor: string;
  privacyMode: boolean;
  saving: boolean;
  settingsReady: boolean;
  handleAccentColorChange: (color: string) => void;
  handleTogglePrivacyMode: (enabled: boolean) => void;
}

export function AppSettingsSection({
  accentColor,
  privacyMode,
  saving,
  settingsReady,
  handleAccentColorChange,
  handleTogglePrivacyMode,
}: AppSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <TkSection
      className="tk-settings-section settings-section-app"
      data-tutorial-id="settings-app"
      headingLevel={2}
      title={t("settings.app.title")}
      variant="framed"
    >
      <div className="tk-settings-field">
        <span className="tk-v1-label">{t("settings.app.accentColor")}</span>
        <div
          className="tk-settings-accent-picker"
          role="radiogroup"
          aria-label={t("settings.app.accentColor")}
        >
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "blue"}
            aria-label={t("settings.app.accentBlue")}
            className="tk-settings-accent tk-settings-accent-blue"
            onClick={() => handleAccentColorChange("blue")}
            title={t("settings.app.accentBlue")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "orange"}
            aria-label={t("settings.app.accentOrange")}
            className="tk-settings-accent tk-settings-accent-orange"
            onClick={() => handleAccentColorChange("orange")}
            title={t("settings.app.accentOrange")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "emerald"}
            aria-label={t("settings.app.accentEmerald")}
            className="tk-settings-accent tk-settings-accent-emerald"
            onClick={() => handleAccentColorChange("emerald")}
            title={t("settings.app.accentEmerald")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "rose"}
            aria-label={t("settings.app.accentRose")}
            className="tk-settings-accent tk-settings-accent-rose"
            onClick={() => handleAccentColorChange("rose")}
            title={t("settings.app.accentRose")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "violet"}
            aria-label={t("settings.app.accentViolet")}
            className="tk-settings-accent tk-settings-accent-violet"
            onClick={() => handleAccentColorChange("violet")}
            title={t("settings.app.accentViolet")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "gold"}
            aria-label={t("settings.app.accentGold")}
            className="tk-settings-accent tk-settings-accent-gold"
            onClick={() => handleAccentColorChange("gold")}
            title={t("settings.app.accentGold")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "crimson"}
            aria-label={t("settings.app.accentCrimson")}
            className="tk-settings-accent tk-settings-accent-crimson"
            onClick={() => handleAccentColorChange("crimson")}
            title={t("settings.app.accentCrimson")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "tiffany"}
            aria-label={t("settings.app.accentTiffany")}
            className="tk-settings-accent tk-settings-accent-tiffany"
            onClick={() => handleAccentColorChange("tiffany")}
            title={t("settings.app.accentTiffany")}
          />
          <button
            type="button"
            role="radio"
            aria-checked={accentColor === "gray"}
            aria-label={t("settings.app.accentGray")}
            className="tk-settings-accent tk-settings-accent-gray"
            onClick={() => handleAccentColorChange("gray")}
            title={t("settings.app.accentGray")}
          />
        </div>
      </div>

      <TkSwitch
        className="tk-settings-separated-row"
        label={t("settings.app.privacyMode")}
        description={t("settings.app.privacyModeHint")}
        checked={privacyMode}
        onChange={handleTogglePrivacyMode}
        disabled={saving || !settingsReady}
      />
    </TkSection>
  );
}
