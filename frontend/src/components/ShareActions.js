import { useEffect, useMemo, useState } from "react";

import { useToast } from "./ToastProvider";
import {
  CheckCircleIcon,
  LinkIcon,
  QrCodeIcon,
  ShareIcon,
  WhatsAppIcon,
} from "./UiIcons";

function buildQrUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
}

export default function ShareActions({
  url,
  title,
  text,
  copyLabel = "Copy link",
  copySuccessMessage = "Link copied!",
  qrTitle = "Scan or download this QR code.",
  className = "",
}) {
  const toast = useToast();
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrUrl = useMemo(() => (url ? buildQrUrl(url) : ""), [url]);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  if (!url) {
    return null;
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(copySuccessMessage, { title: "Copied" });
    } catch {
      toast.error("We could not copy that link right now.", { title: "Copy failed" });
    }
  };

  const handleGeneralShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
      }
    }

    await copyLink();
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(text ? `${text}` : url);
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const openQrInNewTab = () => {
    window.open(qrUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={className}>
      <div className="sv-share-buttons">
        <button
          type="button"
          className={`sv-share-btn sv-share-btn--copy ${copied ? "is-copied" : ""}`}
          onClick={() => {
            void copyLink();
          }}
          title={copyLabel}
        >
          {copied ? <CheckCircleIcon className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
          <span>{copied ? "Copied" : copyLabel}</span>
        </button>

        <button
          type="button"
          className="sv-share-btn sv-share-btn--whatsapp"
          onClick={handleWhatsAppShare}
          title="Share on WhatsApp"
        >
          <WhatsAppIcon className="h-4 w-4" />
          <span>WhatsApp</span>
        </button>

        <button
          type="button"
          className="sv-share-btn"
          onClick={() => {
            void handleGeneralShare();
          }}
          title="Share"
        >
          <ShareIcon className="h-4 w-4" />
          <span>Share</span>
        </button>

        <button
          type="button"
          className={`sv-share-btn sv-share-btn--qr ${showQr ? "is-open" : ""}`}
          onClick={() => setShowQr((current) => !current)}
          title="Show QR code"
        >
          <QrCodeIcon className="h-4 w-4" />
          <span>{showQr ? "Hide QR" : "QR code"}</span>
        </button>
      </div>

      {showQr ? (
        <div className="sv-qr-card">
          <div className="sv-qr-card-media">
            <img src={qrUrl} alt={`QR code for ${title || "shared link"}`} />
          </div>
          <div className="sv-qr-card-copy">
            <p className="sv-qr-card-title">QR ready</p>
            <p className="sv-qr-card-text">{qrTitle}</p>
          </div>
          <button type="button" className="sv-btn-secondary" onClick={openQrInNewTab}>
            Download QR
          </button>
        </div>
      ) : null}
    </div>
  );
}
