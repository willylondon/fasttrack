"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Download, LoaderCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import {
  SHARE_CARD_SIZES,
  ShareFastCard,
  ShareFastCardPreview,
  type ShareCardFormat,
  type ShareCardTheme,
} from "@/components/dashboard/share-fast-card";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { formatCompactDuration } from "@/lib/fasting";
import { safeStorageRead, safeStorageWrite } from "@/lib/local-dashboard";
import { cn } from "@/lib/utils";

const SHARE_CARD_PREFERENCES_KEY = "fasttrack:share-card:v1";
const RECENT_FAST_MS = 12 * 60 * 60 * 1000;

type ShareCardOptions = {
  format: ShareCardFormat;
  theme: ShareCardTheme;
  showTimes: boolean;
};

const DEFAULT_SHARE_CARD_OPTIONS: ShareCardOptions = { format: "post", theme: "dusk", showTimes: true };

const OPTION_GROUPS = [
  { key: "format", label: "Format", options: [{ value: "post", label: "Post" }, { value: "story", label: "Story" }] },
  { key: "theme", label: "Look", options: [{ value: "dusk", label: "Dusk" }, { value: "daybreak", label: "Daybreak" }] },
] as const;

function readShareCardOptions(): ShareCardOptions {
  try {
    const parsed = JSON.parse(safeStorageRead("localStorage", SHARE_CARD_PREFERENCES_KEY) ?? "null") as Partial<ShareCardOptions> | null;
    return {
      format: parsed?.format === "story" ? "story" : "post",
      theme: parsed?.theme === "daybreak" ? "daybreak" : "dusk",
      showTimes: parsed?.showTimes !== false,
    };
  } catch {
    return DEFAULT_SHARE_CARD_OPTIONS;
  }
}

export type ShareableFast = {
  id: string;
  durationMinutes: number;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  currentStreak?: number | null;
  totalFasts?: number | null;
};

type ShareFastPanelProps = {
  fast: ShareableFast;
  onDone: () => void;
  /** Extra content shown between the card options and the action buttons. */
  children?: ReactNode;
};

export function ShareFastPanel({ fast, onDone, children }: ShareFastPanelProps) {
  const [options, setOptions] = useState<ShareCardOptions>(DEFAULT_SHARE_CARD_OPTIONS);
  const [prepared, setPrepared] = useState<{ key: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOptions(readShareCardOptions());
    setMounted(true);
  }, []);

  function updateOptions(next: Partial<ShareCardOptions>) {
    setOptions((current) => {
      const merged = { ...current, ...next };
      safeStorageWrite("localStorage", SHARE_CARD_PREFERENCES_KEY, JSON.stringify(merged));
      return merged;
    });
  }

  const imageKey = [fast.id, fast.durationMinutes, fast.endedAt, fast.currentStreak, fast.totalFasts, options.format, options.theme, options.showTimes].join("|");

  const renderImage = useCallback(async () => {
    const node = cardRef.current;
    if (!node) throw new Error("Share image is not ready yet.");
    const { width, height } = SHARE_CARD_SIZES[options.format];
    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(node, { pixelRatio: 1, canvasWidth: width, canvasHeight: height, width, height });
    if (!blob) throw new Error("Share image generation failed.");
    return blob;
  }, [options.format]);

  // Render ahead of the tap: iOS only allows navigator.share() shortly after a user gesture,
  // so the image must already exist when Share is pressed.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderImage()
        .then((blob) => { if (!cancelled) setPrepared({ key: imageKey, blob }); })
        .catch(() => undefined);
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [renderImage, imageKey, mounted]);

  async function getImage() {
    if (prepared && prepared.key === imageKey) return prepared.blob;
    return renderImage();
  }

  const filename = `fasttrack-${format(new Date(fast.endedAt), "yyyy-MM-dd")}.png`;

  function download(blob: Blob) {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  async function share() {
    setBusy(true);
    try {
      const blob = await getImage();
      const duration = formatCompactDuration(fast.durationMinutes);
      const recent = Date.now() - Date.parse(fast.endedAt) < RECENT_FAST_MS;
      const shareData = {
        files: [new File([blob], filename, { type: "image/png" })],
        text: recent ? `Just finished a ${duration} fast.` : `Fasted ${duration} on ${format(new Date(fast.endedAt), "EEE, MMM d")}.`,
      };

      if (typeof navigator.canShare === "function" && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }

      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          toast.success("Image copied. Paste it into your chat.");
          return;
        } catch {
          // Fall through to a download when clipboard image writes are blocked.
        }
      }

      download(blob);
      toast.success("Image saved. Attach it to your chat.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Unable to create the share image.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      download(await getImage());
      toast.success("Image saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the share image.");
    } finally {
      setBusy(false);
    }
  }

  const cardProps = {
    currentStreak: fast.currentStreak,
    durationMinutes: fast.durationMinutes,
    endedAt: fast.endedAt,
    format: options.format,
    plannedMinutes: fast.plannedMinutes,
    showTimes: options.showTimes,
    startedAt: fast.startedAt,
    theme: options.theme,
    totalFasts: fast.totalFasts,
  };

  return (
    <div className="space-y-4">
      <div className={cn("mx-auto w-full", options.format === "story" ? "max-w-[15rem]" : "max-w-[20rem]")}>
        <ShareFastCardPreview {...cardProps} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OPTION_GROUPS.map((group) => (
          <div key={group.key} role="group" aria-label={group.label} className="grid grid-cols-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
            {group.options.map((option) => {
              const active = options[group.key] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "min-h-10 rounded-lg px-2 text-sm font-medium transition-colors",
                    active ? "bg-white/[0.12] text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => updateOptions({ [group.key]: option.value } as Partial<ShareCardOptions>)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-foreground">
        Show start and end times
        <input
          checked={options.showTimes}
          className="size-5 accent-[hsl(var(--primary))]"
          onChange={(event) => updateOptions({ showTimes: event.target.checked })}
          type="checkbox"
        />
      </label>

      {children}

      <DialogFooter className="gap-2 sm:gap-2">
        <Button disabled={busy} onClick={onDone} variant="ghost">
          Done
        </Button>
        <Button disabled={busy} onClick={() => void save()} variant="outline">
          <Download aria-hidden="true" className="mr-2 size-4" />
          Save image
        </Button>
        <Button disabled={busy} aria-busy={busy} onClick={() => void share()}>
          {busy ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : <Share2 aria-hidden="true" className="mr-2 size-4" />}
          Share
        </Button>
      </DialogFooter>

      {mounted
        ? createPortal(
            <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0">
              <ShareFastCard ref={cardRef} {...cardProps} />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
