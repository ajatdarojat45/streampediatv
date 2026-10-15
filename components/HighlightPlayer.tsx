'use client';

/**
 * The incident-highlight stage of `/watch/{id}` — the frame the page shows when
 * there is no stream left to play (the match is over) or when the viewer picked
 * a highlight to replay.
 *
 * The clips are the publisher's own: Goaloo files an animated GIF with the
 * incidents it animated (a goal, a red card, a shot) and that file is what this
 * frame draws (lib/goalooLive.ts reads them). They are stills, not streams, so
 * the frame is a plain `<img>` in the player's own 16:9 letterbox rather than the
 * <VideoPlayer> — and it is loaded straight from the publisher's clips host,
 * which answers a cross-origin image request without a referer (verified), so
 * nothing is proxied through this app for an image.
 *
 * Everything the frame draws comes from ONE clip, so an empty list is reported
 * by the caller (the component is simply not mounted) and a single clip hides the
 * stepper — the frame never shows a control that cannot do anything.
 */
import { ChevronLeft, ChevronRight, Clapperboard, X } from 'lucide-react';
import type { GoalooLiveClip } from '@/lib/types';

/** Round glass icon-button over the frame — the player's own control recipe. */
const CTRL_BTN =
  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white/90 transition-colors duration-150 hover:bg-black/75 hover:text-white';

/** The publisher's caption chip (`79' · Goal`). */
const CHIP =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-black/55 px-2 py-[2px] text-[11px] font-bold text-white';

export interface HighlightPlayerProps {
  /** The clips the page published, in the publisher's own order (newest first). */
  clips: GoalooLiveClip[];
  /** Index of the clip on screen; clamped here, so a stale index cannot blank
   *  the frame (the list is re-read every time the match centre refreshes). */
  index: number;
  /** Pick another clip — the stepper in the frame and the strip under it both
   *  come through here. */
  onSelect: (index: number) => void;
  /** Leave the highlights and go back to the live stream. Omitted when there is
   *  no stream to go back to (a finished match), and the button is then not
   *  drawn — the frame offers nothing it cannot do. */
  onClose?: () => void;
  /** The fixture's heading, used as the alt text of the clip. */
  title?: string;
}

export default function HighlightPlayer({
  clips,
  index,
  onSelect,
  onClose,
  title,
}: HighlightPlayerProps) {
  const at = Math.min(Math.max(index, 0), Math.max(clips.length - 1, 0));
  const clip = clips[at];
  if (!clip) return null;
  const many = clips.length > 1;
  const caption = clip.title || title || 'Match highlight';

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
      {/* `key` restarts the animation when the clip changes: an animated GIF
          that is still in the page keeps its own frame position, so the same
          <img> would show the new file mid-loop. */}
      <img
        key={clip.url}
        src={clip.url}
        alt={caption}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
      />

      {/* Top-left: what this frame is. Stays visible while the caption bar
          below is drawn over the clip. */}
      <div className="pointer-events-none absolute left-3 top-3 z-[5] flex items-center gap-2">
        <span className={CHIP}>
          <Clapperboard size={12} /> Highlight
        </span>
        {many && (
          <span className={CHIP}>
            {at + 1}/{clips.length}
          </span>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to the live stream"
          title="Back to the live stream"
          className={`absolute right-3 top-3 z-[6] ${CTRL_BTN}`}
        >
          <X size={16} />
        </button>
      )}

      {/* Bottom bar: the publisher's caption plus the stepper. */}
      <div className="absolute inset-x-0 bottom-0 z-[5] flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
        {many && (
          <button
            type="button"
            onClick={() => onSelect(at > 0 ? at - 1 : clips.length - 1)}
            aria-label="Previous highlight"
            title="Previous highlight"
            className={CTRL_BTN}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <span className="min-w-0 flex-1">
          {clip.minute && <span className={`${CHIP} mr-2 tabular-nums`}>{clip.minute}</span>}
          <span className="text-[13px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
            {caption}
          </span>
        </span>
        {many && (
          <button
            type="button"
            onClick={() => onSelect(at + 1 < clips.length ? at + 1 : 0)}
            aria-label="Next highlight"
            title="Next highlight"
            className={CTRL_BTN}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
