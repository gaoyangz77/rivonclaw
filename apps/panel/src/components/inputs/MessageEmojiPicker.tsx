import EmojiPickerModule, {
  Categories,
  EmojiStyle,
  Theme,
  type EmojiClickData,
  type PickerProps,
} from "emoji-picker-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

// NodeNext types this CJS default as a namespace; Vite resolves the component.
const EmojiPicker = EmojiPickerModule as unknown as ComponentType<PickerProps>;

export default function MessageEmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { t } = useTranslation();
  const categories = [
    Categories.SUGGESTED,
    Categories.SMILEYS_PEOPLE,
    Categories.ANIMALS_NATURE,
    Categories.FOOD_DRINK,
    Categories.TRAVEL_PLACES,
    Categories.ACTIVITIES,
    Categories.OBJECTS,
    Categories.SYMBOLS,
    Categories.FLAGS,
  ].map((category) => ({ category, name: t(`messageEmoji.categories.${category}`) }));

  return (
    <EmojiPicker
      onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
      emojiStyle={EmojiStyle.NATIVE}
      theme={document.documentElement.dataset.theme === "dark" ? Theme.DARK : Theme.LIGHT}
      width="100%"
      height={350}
      previewConfig={{ showPreview: false }}
      searchPlaceholder={t("messageEmoji.search")}
      searchClearButtonLabel={t("messageEmoji.clear")}
      categories={categories}
      skinTonesDisabled
    />
  );
}
