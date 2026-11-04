import { useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import type { GQL } from "@rivonclaw/core";
import { TkModal as Modal } from "../../../components/design-system/index.js";
import { usePrivacyMode } from "../../../components/design-system/Privacy.js";

type EvidenceImage = Pick<GQL.EcomImage, "url" | "width" | "height">;
type EvidenceVideo = Pick<
  GQL.EcomReturnRecordVideo,
  "url" | "coverUrl" | "durationMillis" | "width" | "height"
>;

function formatDuration(durationMillis: number | null | undefined): string | null {
  if (!durationMillis || durationMillis < 0) return null;
  const totalSeconds = Math.round(durationMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function Placeholder({ label }: { label: string }) {
  return (
    <span className="cs-order-evidence-placeholder" role="img" aria-label={label}>
      <span aria-hidden="true">?</span>
    </span>
  );
}

const EvidenceImageThumb = observer(function EvidenceImageThumb({
  image,
  label,
}: {
  image: EvidenceImage;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const privacyMode = usePrivacyMode();
  const unavailable = useUnavailableLabel();
  if (!image.url || failed || privacyMode) return <Placeholder label={unavailable} />;
  return (
    <a
      className="cs-order-evidence-thumb"
      href={image.url}
      rel="noreferrer"
      target="_blank"
      aria-label={label}
    >
      <img alt={label} loading="lazy" onError={() => setFailed(true)} src={image.url} />
    </a>
  );
});

const EvidenceVideoThumb = observer(function EvidenceVideoThumb({
  video,
  label,
}: {
  video: EvidenceVideo;
  label: string;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const privacyMode = usePrivacyMode();
  const { t } = useTranslation();
  const unavailable = useUnavailableLabel();
  const duration = formatDuration(video.durationMillis);
  if (!video.url || privacyMode) return <Placeholder label={unavailable} />;
  return (
    <>
      <button
        className="cs-order-evidence-thumb"
        type="button"
        aria-label={duration ? `${label} (${duration})` : label}
        onClick={() => {
          setPlaybackFailed(false);
          setPlayerOpen(true);
        }}
      >
        {video.coverUrl && !coverFailed && (
          <img alt="" loading="lazy" onError={() => setCoverFailed(true)} src={video.coverUrl} />
        )}
        <span className="cs-order-evidence-play" aria-hidden="true">
          &#9654;
        </span>
        {duration && <span className="cs-order-evidence-duration">{duration}</span>}
      </button>
      <Modal
        isOpen={playerOpen}
        onClose={() => setPlayerOpen(false)}
        title={label}
        closeLabel={t("common.close")}
        maxWidth={420}
      >
        {playbackFailed ? (
          <p className="cs-order-empty">{unavailable}</p>
        ) : (
          <video
            className="cs-order-evidence-player"
            controls
            playsInline
            poster={video.coverUrl ?? undefined}
            preload="metadata"
            src={video.url}
            onError={() => setPlaybackFailed(true)}
          />
        )}
      </Modal>
    </>
  );
});

function useUnavailableLabel(): string {
  const { t } = useTranslation();
  return t("ecommerce.customerServiceWorkspace.returnRecordEvidenceUnavailable");
}

/** Buyer evidence (photos and videos) attached to one return record; renders nothing without any. */
export const ReturnRecordEvidence = observer(function ReturnRecordEvidence({
  images,
  videos,
}: {
  images?: ReadonlyArray<EvidenceImage | null> | null;
  videos?: ReadonlyArray<EvidenceVideo | null> | null;
}) {
  const { t } = useTranslation();
  const imageItems = (images ?? []).filter((image): image is EvidenceImage => image != null);
  const videoItems = (videos ?? []).filter((video): video is EvidenceVideo => video != null);
  if (imageItems.length === 0 && videoItems.length === 0) return null;
  const imageLabel = t("ecommerce.customerServiceWorkspace.returnRecordEvidenceImage");
  const videoLabel = t("ecommerce.customerServiceWorkspace.returnRecordEvidenceVideo");
  return (
    <span className="cs-order-evidence">
      {imageItems.map((image, index) => (
        <EvidenceImageThumb image={image} key={`image:${index}`} label={imageLabel} />
      ))}
      {videoItems.map((video, index) => (
        <EvidenceVideoThumb key={`video:${index}`} label={videoLabel} video={video} />
      ))}
    </span>
  );
});
