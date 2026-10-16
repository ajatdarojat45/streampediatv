'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';

/** Default idle delay (ms) before the live control chrome auto-hides. */
export const DEFAULT_AUTO_HIDE_DELAY = 10000;

export interface VideoPlayerProps {
  /** Stream URL — HLS (.m3u8) or any standard HTML5 source (MP4/WebM). */
  streamUrl: string;
  /** Poster image shown before playback starts. */
  posterThumbnail?: string;
  /** Optional referer header — forwarded through the media proxy. */
  referer?: string;
  /** Autoplay on mount. Requires `muted` for browser autoplay policies. */
  autoPlay?: boolean;
  /** Muted playback. Defaults to `autoPlay` so autoplay actually works. */
  muted?: boolean;
  /**
   * Show the custom **live** control bar (play/pause, volume, PiP, fullscreen)
   * plus the floating centre play/pause button. Native VOD chrome — the seek
   * bar and the `currentTime / duration` readout — is never rendered: this
   * component is live-only, so the timeline is intentionally non-seekable.
   */
  controls?: boolean;
  /**
   * Show the persistent red LIVE badge pinned to the **top-left** of the frame
   * (stays visible even while the control chrome is idle). Defaults to true.
   * The control bar no longer renders its own badge — only this one.
   */
  live?: boolean;
  /**
   * Idle delay (ms) before the control chrome auto-hides while the stream is
   * playing. Defaults to {@link DEFAULT_AUTO_HIDE_DELAY} (10 s) — kept generous
   * on purpose so viewers do not have to re-interact (and re-trigger the
   * player's ads) just to bring play/pause, volume and fullscreen back.
   */
  autoHideDelay?: number;
  /** Fired when the video is paused. */
  onPause?: () => void;
  /** Fired when the video starts/resumes playing. */
  onPlay?: () => void;
  /** Fired when the video ends. */
  onEnded?: () => void;
  /** Fired on fatal playback errors (HLS failure, unsupported browser, ...). */
  onError?: (message: string) => void;
  className?: string;
  /** Accessible label for the <video> element. */
  title?: string;
}

/* ------------------------------------------------------------------------- *
 * Live control chrome — Tailwind class strings (kept top-level so they are
 * stable references and easy to scan, matching the rest of the app).
 * ------------------------------------------------------------------------- */

/** Round glass icon-button used throughout the live control bar. */
const CTRL_BTN =
  'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white';

/** Floating centre play/pause button (semi-transparent, nudges on hover). */
const CENTER_BTN =
  'inline-flex cursor-pointer items-center justify-center rounded-full bg-black/50 p-4 text-white shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-all hover:scale-105 hover:bg-black/70';

/** Bold red LIVE badge — same recipe as the match-card `LIVE` tag. */
const LIVE_BADGE =
  'inline-flex shrink-0 items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white';

/**
 * Lightweight video player built on native Hls.js (no Plyr) so the bundle stays
 * small on Vercel. Detects HLS by the `.m3u8` URL and falls back to the native
 * HTML5 player for other formats (or Safari's built-in HLS support).
 *
 * Live-only chrome: the native `<video controls>` attribute is deliberately
 * never set, so the browser cannot render a draggable seek bar or a
 * `currentTime / duration` readout — both meaningless (and error-prone) for a
 * live stream. In their place the component paints its own controls:
 * play/pause, volume/mute, picture-in-picture and fullscreen, plus a persistent
 * red LIVE badge pinned to the top-left and a floating centre play/pause button.
 */
export default function VideoPlayer({
  streamUrl,
  posterThumbnail,
  referer,
  autoPlay = true,
  muted = true,
  controls = true,
  live = true,
  autoHideDelay = DEFAULT_AUTO_HIDE_DELAY,
  onPause,
  onPlay,
  onEnded,
  onError,
  className,
  title,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest auto-hide delay, read inside the timer without re-running effects. */
  const autoHideDelayRef = useRef(autoHideDelay);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  /** Control chrome visibility — also hides on mouse-leave and while playing. */
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);

  // Keep the latest callbacks in refs so the media effect does not re-run on
  // every render (same pattern as the existing StreamPlayer).
  const onPauseRef = useRef(onPause);
  const onPlayRef = useRef(onPlay);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);
  useEffect(() => {
    onPlayRef.current = onPlay;
  }, [onPlay]);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    autoHideDelayRef.current = autoHideDelay;
  }, [autoHideDelay]);

  /** Cancel the auto-hide timer (mouse leave, pause, unmount). */
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  /** Fade the controls out after `autoHideDelay` ms of idle while playing. */
  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (videoRef.current && !videoRef.current.paused) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), autoHideDelayRef.current);
    }
  }, [clearHideTimer]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return undefined;
    setError('');
    setPlaying(false);

    const emitError = (message: string): void => {
      setError(message);
      onErrorRef.current?.(message);
    };

    let hls: Hls | undefined;
    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
    // Route http(s) streams through the media proxy so the app UA/origin/referer
    // headers are attached (required by the upstream CDN).
    const src = /^https?:\/\//i.test(streamUrl)
      ? `/api/media-proxy?url=${encodeURIComponent(streamUrl)}${referer ? `&referer=${encodeURIComponent(referer)}` : ''}`
      : streamUrl;

    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({ maxBufferLength: 30 });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            emitError(`HLS error: ${data.type} / ${data.details}`);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari/WebKit — native HLS, no hls.js needed.
        video.src = src;
      } else {
        emitError('Browser does not support HLS playback.');
      }
    } else {
      // Standard HTML5 source (MP4/WebM, ...).
      video.src = src;
    }

    const handlePause = (): void => {
      setPlaying(false);
      setControlsVisible(true); // keep the centre play button reachable
      clearHideTimer();
      onPauseRef.current?.();
    };
    const handlePlay = (): void => {
      setPlaying(true);
      scheduleHide();
      onPlayRef.current?.();
    };
    const handleEnded = (): void => {
      setPlaying(false);
      setControlsVisible(true);
      onEndedRef.current?.();
    };
    const handleError = (): void => emitError('Video playback error.');
    /** Mirror the element's own muted/volume state into the React tree. */
    const handleVolumeChange = (): void => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);
    video.addEventListener('playing', handlePlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('volumechange', handleVolumeChange);

    if (autoPlay) {
      // Autoplay policies require muted; if it's still blocked, the user can
      // press play via the native controls.
      video.play().catch(() => {});
    }

    return () => {
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('playing', handlePlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('volumechange', handleVolumeChange);
      if (hls) hls.destroy();
    };
  }, [streamUrl, referer, autoPlay, clearHideTimer, scheduleHide]);

  /* Fullscreen + picture-in-picture support & state (browser-only). */
  useEffect(() => {
    setPipSupported(
      document.pictureInPictureEnabled === true &&
        'requestPictureInPicture' in HTMLVideoElement.prototype,
    );

    const video = videoRef.current;
    const handleFullscreen = (): void => setIsFullscreen(Boolean(document.fullscreenElement));
    const handleEnterPip = (): void => setIsPip(true);
    const handleLeavePip = (): void => setIsPip(false);

    document.addEventListener('fullscreenchange', handleFullscreen);
    video?.addEventListener('enterpictureinpicture', handleEnterPip);
    video?.addEventListener('leavepictureinpicture', handleLeavePip);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreen);
      video?.removeEventListener('enterpictureinpicture', handleEnterPip);
      video?.removeEventListener('leavepictureinpicture', handleLeavePip);
    };
  }, []);

  /** Click-to-toggle play/pause — shared by the frame, centre and bar button. */
  const togglePlay = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void video.play().catch(() => {});
    else video.pause();
  }, []);

  const toggleMute = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const changeVolume = useCallback((value: number): void => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, value));
    video.volume = next;
    video.muted = next === 0;
  }, []);

  const togglePip = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* unsupported / blocked by the browser */
    }
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* unsupported / blocked by the browser */
    }
  }, []);

  /** Volume icon reflects the live mute/level state. */
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  /** Centre button mirrors playback: Play while paused, **Pause while playing**.
   *  It shows whenever the player chrome is visible (pointer over the frame or
   *  an interaction just happened) and fades out on mouse-leave / while idle. */
  const centerVisible = controls && controlsVisible;

  return (
    <div
      ref={containerRef}
      className={`group relative aspect-[16/9] overflow-hidden rounded border border-border bg-black [&:fullscreen]:aspect-auto [&:fullscreen]:rounded-none ${className ?? ''}`}
      onMouseEnter={() => {
        setControlsVisible(true);
        scheduleHide();
      }}
      onMouseMove={() => {
        setControlsVisible(true);
        scheduleHide();
      }}
      onMouseLeave={() => {
        clearHideTimer();
        setControlsVisible(false);
      }}
    >
      {/* Native `controls` is intentionally OFF here: that is what removes the
          VOD seek bar and the `currentTime / duration` readout for good. */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        preload="metadata"
        poster={posterThumbnail || undefined}
        title={title}
        aria-label={title || 'Live video player'}
        onClick={controls ? togglePlay : undefined}
      />

      {controls && (
        <>
          {/* Persistent LIVE badge (top-left) — stays put even when chrome idle. */}
          {live && (
            <span
              className={`${LIVE_BADGE} pointer-events-none absolute left-3 top-3 z-[3] shadow-[0_1px_4px_rgba(0,0,0,0.45)]`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-current animate-[blink_1.2s_infinite]"
                aria-hidden="true"
              />
              Live
            </span>
          )}

          {/* Floating centre play/pause — click the frame or the button itself. */}
          <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
              className={`${CENTER_BTN} ${centerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none scale-90 opacity-0'}`}
            >
              {playing ? (
                <Pause size={40} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={40} fill="currentColor" className="ml-1" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Live control bar: play/pause · volume · PiP · fullscreen. The red
              LIVE badge itself is rendered top-left (persistent, even when idle). */}
          <div
            className={`absolute inset-x-0 bottom-0 z-[6] flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 transition-opacity ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
              className={CTRL_BTN}
            >
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>

            {/* Volume: the icon toggles mute; the slider (desktop) fine-tunes. */}
            <div className="group/vol flex items-center">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
                className={CTRL_BTN}
              >
                <VolumeIcon size={18} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 w-0 cursor-pointer opacity-0 transition-all accent-[var(--accent)] group-hover/vol:w-20 group-hover/vol:opacity-100 max-[640px]:hidden"
              />
            </div>

            <span className="flex-1" />

            {pipSupported && (
              <button
                type="button"
                onClick={() => void togglePip()}
                aria-label={isPip ? 'Exit picture-in-picture' : 'Picture-in-picture'}
                title="Picture-in-picture"
                className={CTRL_BTN}
              >
                <PictureInPicture2 size={18} />
              </button>
            )}

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              title="Fullscreen"
              className={CTRL_BTN}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </>
      )}

      {error && (
        <p
          className="absolute inset-x-3 bottom-16 z-[7] m-0 whitespace-pre-wrap break-words rounded-lg bg-[rgba(0,0,0,0.6)] px-3 py-2.5 text-[13px] text-[#fca5a5]"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
