"use client";

import Image from "next/image";
import Link from "@/components/loading/NavigationLink";
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import Icon from "./Icon";
import { initialState, nextAvailable, sliderReducer } from "@/lib/gallery-state";
import { decodeGalleryImage } from "@/lib/gallery-swipe";
import { useGallerySwipe } from "./useGallerySwipe";
import styles from "./HeroSlider.module.css";
import type { Locale } from "@/lib/i18n";

type Slide = {
  id: string;
  src: string;
  alt: string;
  href: string;
  linkLabel: string;
};

type HeroSliderProps = {
  locale: Locale;
  slides: readonly Slide[];
  labels: {
    carousel: string;
    previous: string;
    next: string;
    select: string;
    status: string;
    newTab: string;
  };
};

function formatLabel(template: string, number: number, total: number) {
  return template
    .replace("{number}", String(number))
    .replace("{total}", String(total));
}

function subscribeReducedMotion(onChange: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}
const reducedMotionSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotionSnapshot = () => false;

export default function HeroSlider({ locale, slides, labels }: HeroSliderProps) {
  return <Slider key={JSON.stringify(slides.map(({ id, src }) => [id, src]))} locale={locale} slides={slides} labels={labels} />;
}

function Slider({ locale, slides, labels }: HeroSliderProps) {
  const roleLabels = {
    en: { carousel: "carousel", slide: "slide", pause: "Pause slide rotation", play: "Start slide rotation", reducedMotion: "Automatic slide rotation is disabled by your reduced motion preference" },
    ar: { carousel: "عرض شرائح", slide: "شريحة", pause: "إيقاف التدوير التلقائي للشرائح", play: "بدء التدوير التلقائي للشرائح", reducedMotion: "تم تعطيل التدوير التلقائي للشرائح وفقًا لتفضيلك لتقليل الحركة" },
    th: { carousel: "ภาพสไลด์", slide: "สไลด์", pause: "หยุดเปลี่ยนสไลด์อัตโนมัติ", play: "เริ่มเปลี่ยนสไลด์อัตโนมัติ", reducedMotion: "ปิดการเปลี่ยนสไลด์อัตโนมัติตามการตั้งค่าลดการเคลื่อนไหวของคุณ" },
  }[locale];
  const [state, dispatch] = useReducer(sliderReducer, initialState);
  const [isHovered, setIsHovered] = useState(false);
  const [rotationPaused, setRotationPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, serverMotionSnapshot);
  const [indicatorLimit, setIndicatorLimit] = useState(slides.length);
  const navigationRef = useRef<HTMLDivElement | null>(null);
  const indicatorRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const pointerRotationRequest = useRef<boolean | null>(null);
  const focusIndicatorAfterNavigation = useRef(false);
  const total = slides.length;
  const rotationStopped = rotationPaused || reducedMotion;
  const playbackPaused = isHovered || rotationStopped;
  const next = nextAvailable(state.active, 1, total, state.failed);
  const previous = nextAvailable(state.active, -1, total, state.failed);
  const currentReady = state.loaded.has(state.active);
  const nextReady = state.loaded.has(next);
  const preparedImages = useMemo(() => new Set(
    // Give the visible image the connection first. Neighbours are prepared only
    // after it has decoded; a requested slide still starts loading immediately.
    [state.active, ...(currentReady ? [next, previous] : []), state.pending, state.outgoing].filter(
      (index): index is number =>
        index !== null && index < total && !state.failed.has(index),
    ),
  ), [state.active, next, previous, state.pending, state.outgoing, state.failed, total, currentReady]);
  const indicatorCount = Math.min(total, indicatorLimit);
  const visibleIndicators = Array.from(
    { length: indicatorCount },
    (_, offset) => indicatorCount === total
      ? offset
      : (state.active - Math.floor(indicatorCount / 2) + offset + total) % total,
  );

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    const updateLimit = () => {
      const previousButton = navigation.firstElementChild;
      const nextButton = navigation.lastElementChild;
      const indicator = navigation.querySelector<HTMLButtonElement>("[aria-pressed]");
      if (!previousButton || !nextButton || !indicator) return;

      const first = previousButton.getBoundingClientRect();
      const last = nextButton.getBoundingClientRect();
      const available = Math.max(first.left, last.left) - Math.min(first.right, last.right);
      const buttonWidth = indicator.getBoundingClientRect().width;
      if (buttonWidth <= 0) return;

      let limit = Math.max(1, Math.min(total, Math.floor(available / buttonWidth)));
      if (limit < total && limit % 2 === 0) limit -= 1;
      setIndicatorLimit((current) => current === limit ? current : limit);
    };

    updateLimit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateLimit);
    observer?.observe(navigation);
    window.addEventListener("resize", updateLimit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLimit);
    };
  }, [total]);

  useEffect(() => {
    for (const index of preparedImages) {
      if (state.loaded.has(index)) continue;
      const image = imageRefs.current[index];
      if (image?.complete && image.naturalWidth > 0) {
        void decodeGalleryImage(image).then((ready) => {
          if (ready && imageRefs.current[index] === image) dispatch({ type: "loaded", index });
        });
      }
    }
  }, [preparedImages, state.loaded]);

  useEffect(() => {
    if (
      total < 2 ||
      next === state.active ||
      state.pending !== null ||
      playbackPaused ||
      !currentReady ||
      !nextReady
    ) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timeout: number | undefined;
    const schedule = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (!motionPreference.matches && document.visibilityState === "visible") {
        timeout = window.setTimeout(() => {
          dispatch({ type: "request", index: next, total });
        }, 3000);
      }
    };

    schedule();
    motionPreference.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      motionPreference.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [state.active, state.pending, next, total, playbackPaused, currentReady, nextReady]);

  useEffect(() => {
    if (state.outgoing === null) return;
    const timeout = window.setTimeout(() => {
      dispatch({ type: "settled", transitionId: state.transitionId });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [state.outgoing, state.transitionId]);

  useEffect(() => {
    if (!focusIndicatorAfterNavigation.current || state.pending !== null) return;
    indicatorRefs.current[state.active]?.focus({ preventScroll: true });
    focusIndicatorAfterNavigation.current = false;
  }, [state.active, state.pending]);

  function select(index: number) {
    setRotationPaused(true);
    dispatch({
      type: "request",
      index,
      total,
      announcement: formatLabel(labels.status, index + 1, total),
    });
  }

  function move(direction: number) {
    select(nextAvailable(state.pending ?? state.active, direction, total, state.failed));
  }

  const swipe = useGallerySwipe(move, total > 1);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, fromIndicator = false) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let target: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      target = nextAvailable(
        state.active,
        (event.key === "ArrowRight" ? 1 : -1) * (getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1),
        total,
        state.failed,
      );
    } else if (event.key === "Home" || event.key === "End") {
      const indexes = Array.from({ length: total }, (_, index) => index);
      if (event.key === "End") indexes.reverse();
      target = indexes.find((index) => !state.failed.has(index)) ?? null;
    }
    if (target === null || target === state.active) return;
    event.preventDefault();
    if (fromIndicator) focusIndicatorAfterNavigation.current = true;
    select(target);
  }

  if (total === 0 || state.failed.size === total) return null;

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-roledescription={roleLabels.carousel}
      aria-label={labels.carousel}
      onPointerEnter={(event) => {
        if (
          event.pointerType !== "touch" &&
          window.matchMedia("(hover: hover) and (pointer: fine) and (not (any-pointer: coarse))").matches
        ) {
          setIsHovered(true);
        }
      }}
      onPointerLeave={() => setIsHovered(false)}
      onPointerDown={(event) => {
        if (event.pointerType === "touch") {
          setIsHovered(false);
        }
      }}
      onFocusCapture={() => setRotationPaused(true)}
    >
      {total > 1 && (
        <button
          className={`${styles.arrow} ${styles.rotation}`}
          type="button"
          data-carousel-rotation
          data-rotation={rotationStopped ? "paused" : "playing"}
          aria-label={reducedMotion ? roleLabels.reducedMotion : rotationStopped ? roleLabels.play : roleLabels.pause}
          disabled={reducedMotion}
          onPointerDown={() => {
            // Focusing the button pauses rotation. Preserve the action the
            // pointer requested before focus so a Pause click cannot restart it.
            pointerRotationRequest.current = !rotationStopped;
          }}
          onPointerCancel={() => { pointerRotationRequest.current = null; }}
          onClick={(event) => {
            setRotationPaused(event.detail > 0 && pointerRotationRequest.current !== null ? pointerRotationRequest.current : !rotationStopped);
            pointerRotationRequest.current = null;
          }}
        >
          {rotationStopped ? <Play size="1.375rem" strokeWidth={1.5} aria-hidden="true" /> : <Pause size="1.375rem" strokeWidth={1.5} aria-hidden="true" />}
        </button>
      )}
      <div className={styles.slider} {...swipe} aria-busy={state.pending !== null}>
        {slides.map((slide, index) => preparedImages.has(index) && (
          <div
            key={slide.id}
            className={`${styles.slide} ${index === state.active ? styles.active : ""}`}
            role="group"
            aria-roledescription={roleLabels.slide}
            aria-label={formatLabel(labels.status, index + 1, total)}
            aria-hidden={index !== state.active}
          >
            <Link
              href={slide.href}
              className={styles.slideLink}
              aria-label={`${slide.linkLabel} (${labels.newTab})`}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={index === state.active ? 0 : -1}
              prefetch={index === state.active ? undefined : false}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                loading="eager"
                fetchPriority={index === state.active || index === state.pending ? "high" : "low"}
                sizes="(max-width: 1024px) 170vw, 100vw"
                className={styles.image}
                draggable={false}
                ref={(element) => { imageRefs.current[index] = element; }}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  void decodeGalleryImage(image).then((ready) => {
                    if (ready && imageRefs.current[index] === image) dispatch({ type: "loaded", index });
                  });
                }}
                onError={() => dispatch({ type: "failed", index, total })}
              />
            </Link>
          </div>
        ))}
      </div>

      {total > 1 && (
        <div className={styles.controls}>
          <div className={styles.navigation} ref={navigationRef}>
            <button
              className={styles.arrow}
              type="button"
              aria-label={labels.previous}
              onClick={() => move(-1)}
              onKeyDown={handleKeyDown}
            >
              <Icon name="chevronLeft" size={30} />
            </button>
            <div className={styles.indicators} role="group" aria-label={labels.carousel}>
              {visibleIndicators.map((index) => (
                <button
                  key={slides[index].id}
                  ref={(element) => { indicatorRefs.current[index] = element; }}
                  className={`${styles.indicator} ${index === state.active ? styles.indicatorActive : ""}`}
                  type="button"
                  aria-label={formatLabel(labels.select, index + 1, total)}
                  aria-pressed={index === state.active}
                  tabIndex={index === state.active ? 0 : -1}
                  disabled={state.failed.has(index)}
                  onClick={() => select(index)}
                  onKeyDown={(event) => handleKeyDown(event, true)}
                />
              ))}
            </div>
            <button
              className={styles.arrow}
              type="button"
              aria-label={labels.next}
              onClick={() => move(1)}
              onKeyDown={handleKeyDown}
            >
              <Icon name="chevron" size={30} />
            </button>
          </div>
        </div>
      )}
      <span className="srOnly" role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </span>
    </div>
  );
}
