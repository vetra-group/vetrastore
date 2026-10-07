"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, LoaderCircle, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type KeyboardEvent } from "react";
import { initialState, nextAvailable, sliderReducer } from "@/lib/gallery-state";
import { decodeGalleryImage } from "@/lib/gallery-swipe";
import { Modal } from "@/components/ui/Modal";
import { useGallerySwipe } from "@/components/useGallerySwipe";
import styles from "./HoneyGallery.module.css";

export interface HoneyGalleryLabels {
  gallery: string;
  zoom: string;
  zoomIn: string;
  zoomOut: string;
  close: string;
  previous: string;
  next: string;
  product: string;
  front: string;
  back: string;
  lifestyle: string;
  loading: string;
  unavailable: string;
  retry: string;
}

type GallerySlide = { key: string; src: string; label: string; alt: string; kind: string };
interface HoneyGalleryProps {
  labels: HoneyGalleryLabels;
  productSrc: string;
  productAlt: string;
  lifestyleAlt: string;
  images?: readonly GallerySlide[];
}

const imageSizes = "(max-width: 60rem) 90vw, (max-width: 120rem) 45vw, 56rem";

export default function HoneyGallery({ labels, productSrc, productAlt, lifestyleAlt, images }: HoneyGalleryProps) {
  const fallback = [
    { key: "product", src: productSrc, label: labels.product, alt: productAlt, kind: "product" },
    { key: "front", src: "/images/honey-front.jpg", label: labels.front, alt: labels.front, kind: "label" },
    { key: "back", src: "/images/honey-back.jpg", label: labels.back, alt: labels.back, kind: "label" },
    { key: "lifestyle", src: "/images/hero-eshan-4.webp", label: labels.lifestyle, alt: lifestyleAlt, kind: "lifestyle" },
  ];
  const slides = images === undefined ? fallback : images.length ? images : [fallback[0]];
  // A changed published gallery gets fresh load state; old indexes cannot refer
  // to different assets after a preview or language/content refresh.
  return <Gallery key={JSON.stringify(slides.map(({ key, src }) => [key, src]))} labels={labels} slides={slides} />;
}

function Gallery({ labels, slides }: { labels: HoneyGalleryLabels; slides: readonly GallerySlide[] }) {
  const [state, dispatch] = useReducer(sliderReducer, initialState);
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMounted, setDialogMounted] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [zoomReady, setZoomReady] = useState<string | null>(null);
  const [errorIndex, setErrorIndex] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Record<number, number>>({});
  const imageRegionRef = useRef<HTMLDivElement>(null);
  const thumbnailRail = useRef<HTMLDivElement>(null);
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const focusAfterSelection = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const total = slides.length;
  const current = slides[state.active];
  const ready = state.loaded.has(state.active);
  const next = nextAvailable(state.active, 1, total, state.failed);
  const previous = nextAvailable(state.active, -1, total, state.failed);
  const prepared = useMemo(() => new Set(
    [state.active, ...(ready ? [next, previous] : []), state.pending, state.outgoing].filter(
      (index): index is number => index !== null && !state.failed.has(index),
    ),
  ), [state.active, state.pending, state.outgoing, state.failed, next, previous, ready]);

  useEffect(() => {
    for (const index of prepared) {
      const image = imageRefs.current[index];
      if (!state.loaded.has(index) && image?.complete && image.naturalWidth > 0) {
        void decodeGalleryImage(image).then((decoded) => {
          if (decoded && imageRefs.current[index] === image) dispatch({ type: "loaded", index });
        });
      }
    }
  }, [prepared, state.loaded]);

  useEffect(() => {
    if (state.outgoing === null) return;
    const timeout = window.setTimeout(() => dispatch({ type: "settled", transitionId: state.transitionId }), 500);
    return () => window.clearTimeout(timeout);
  }, [state.outgoing, state.transitionId]);

  useEffect(() => {
    const rail = thumbnailRail.current;
    const thumbnail = thumbnails.current[state.active];
    if (!rail || !thumbnail) return;
    const keepVisible = () => {
      if (rail.scrollWidth <= rail.clientWidth + 1) return;
      const bounds = rail.getBoundingClientRect();
      const button = thumbnail.getBoundingClientRect();
      if (button.left >= bounds.left && button.right <= bounds.right) return;
      rail.scrollBy({ left: (button.left + button.right - bounds.left - bounds.right) / 2, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    };
    keepVisible();
    const observer = new ResizeObserver(keepVisible);
    observer.observe(rail);
    if (focusAfterSelection.current && state.pending === null) {
      thumbnail.focus({ preventScroll: true });
      focusAfterSelection.current = false;
    }
    return () => observer.disconnect();
  }, [state.active, state.pending]);

  useEffect(() => {
    const region = imageRegionRef.current;
    if (!region) return;
    region.scrollTop = zoomed ? (region.scrollHeight - region.clientHeight) / 2 : 0;
    region.scrollLeft = zoomed ? (region.scrollWidth - region.clientWidth) / 2 * (getComputedStyle(region).direction === "rtl" ? -1 : 1) : 0;
    if (isOpen && zoomed) region.focus({ preventScroll: true });
  }, [state.active, isOpen, zoomed]);

  function select(index: number) {
    setErrorIndex(null);
    setZoomed(false);
    if (state.failed.has(index)) {
      setAttempts((value) => ({ ...value, [index]: (value[index] ?? 0) + 1 }));
      dispatch({ type: "retry", index, total });
    } else {
      dispatch({ type: "request", index, total, announcement: slides[index].label });
    }
  }

  function move(direction: number) {
    select(nextAvailable(state.pending ?? state.active, direction, total, state.failed));
  }

  function handleKeys(event: KeyboardEvent<HTMLElement>, fromThumbnail = false) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Enlarged images keep native arrow-key scrolling and touch panning.
    if (zoomed && event.target === imageRegionRef.current) return;
    let index: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") index = nextAvailable(state.pending ?? state.active, (event.key === "ArrowRight" ? 1 : -1) * (getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1), total, state.failed);
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = total - 1;
    if (index === null) return;
    event.preventDefault();
    focusAfterSelection.current = fromThumbnail;
    select(index);
  }

  const swipe = useGallerySwipe(move, total > 1);
  const dialogSwipe = useGallerySwipe(move, total > 1 && !zoomed);
  const busy = state.pending !== null;

  function imageLayer(index: number, modal = false) {
    const slide = slides[index];
    return <span key={`${slide.key}-${attempts[index] ?? 0}`} className={`${modal ? styles.dialogFrame : styles.frame} ${index === state.active ? styles.active : ""}`} data-kind={slide.kind} aria-hidden={index !== state.active}>
      <Image src={slide.src} alt={index === state.active ? slide.alt : ""} fill sizes={imageSizes} loading={ready || busy || modal ? "eager" : "lazy"} fetchPriority={index === state.pending ? "high" : "auto"} className={modal ? styles.dialogPhoto : styles.photo} draggable={false}
        ref={modal ? undefined : (element) => { imageRefs.current[index] = element; }}
        onLoad={modal ? undefined : (event) => {
          const image = event.currentTarget;
          void decodeGalleryImage(image).then((decoded) => {
            if (decoded && imageRefs.current[index] === image) dispatch({ type: "loaded", index });
          });
        }}
        onError={modal ? undefined : () => {
          if (index === state.active || index === state.pending) setErrorIndex(index);
          dispatch({ type: "failed", index, total });
        }}
      />
      {!modal && slide.kind === "product" && <span className={styles.brand} aria-hidden="true">ESHAN</span>}
    </span>;
  }

  return (
    <div className={styles.gallery} aria-label={labels.gallery} data-gallery="product">
      <button type="button" className={styles.imageButton} aria-label={`${labels.zoom}: ${current.label}`} aria-haspopup="dialog" aria-busy={busy} disabled={!ready} {...swipe} onKeyDown={(event) => handleKeys(event)} onClick={() => { setDialogMounted(true); setIsOpen(true); }}>
        <span className={styles.mainImage}>
          {[...prepared].map((index) => imageLayer(index))}
          <span className={styles.expandIcon} aria-hidden="true">{busy ? <LoaderCircle className={styles.spinner} /> : <Expand />}</span>
        </span>
        <span className={styles.caption}>{current.label}<span>{labels.zoom}</span></span>
      </button>

      {total > 1 && <div className={styles.galleryNavigation}>
        <button className={styles.iconButton} type="button" aria-label={labels.previous} disabled={next === state.active} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
        <div ref={thumbnailRail} className={styles.thumbnails} role="group" aria-label={labels.gallery}>
          {slides.map((slide, index) => <button ref={(element) => { thumbnails.current[index] = element; }} type="button" key={slide.key} className={styles.thumbnail} aria-label={slide.label} aria-pressed={state.active === index} aria-busy={state.pending === index} tabIndex={state.active === index ? 0 : -1} onClick={() => select(index)} onKeyDown={(event) => handleKeys(event, true)}>
            <span className={styles.thumbnailImage} data-kind={slide.kind}><Image src={slide.src} alt="" fill sizes="7rem" className={styles.photo} draggable={false} /></span>
            <span className="srOnly">{slide.label}</span>
          </button>)}
        </div>
        <button className={styles.iconButton} type="button" aria-label={labels.next} disabled={next === state.active} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
      </div>}
      <div className={styles.feedback} aria-live="polite" aria-atomic="true">
        {errorIndex !== null ? <p>{labels.unavailable} <button type="button" onClick={() => select(errorIndex)}>{labels.retry}</button></p> : <span className="srOnly">{busy ? labels.loading : state.announcement}</span>}
      </div>

      {dialogMounted && <Modal label={labels.gallery} className={styles.dialog} open={isOpen} animate initialFocusRef={closeButtonRef} onClose={() => { setIsOpen(false); setZoomed(false); }} onAfterClose={() => setDialogMounted(false)}>
        <div className={styles.dialogPanel} onKeyDown={(event) => handleKeys(event)}>
          <div className={styles.dialogHeader}>
            <h2>{labels.gallery}</h2>
            <div className={styles.dialogTools}>
              <button type="button" className={styles.iconButton} aria-label={zoomed ? labels.zoomOut : labels.zoomIn} aria-pressed={zoomed} onClick={() => setZoomed((value) => !value)}>{zoomed ? <ZoomOut aria-hidden="true" /> : <ZoomIn aria-hidden="true" />}</button>
              <button ref={closeButtonRef} type="button" className={styles.iconButton} aria-label={labels.close} onClick={() => { setIsOpen(false); setZoomed(false); }}><X aria-hidden="true" /></button>
            </div>
          </div>
          <div ref={imageRegionRef} className={styles.dialogImage} role="region" aria-label={current.label} aria-busy={busy} tabIndex={zoomed ? 0 : -1} data-zoomed={zoomed} {...dialogSwipe}>
            <div className={styles.dialogCanvas} data-zoomed={zoomed}>
              {[...prepared].map((index) => imageLayer(index, true))}
              {zoomed && <Image key={current.key} src={current.src} alt="" fill sizes="(max-width: 48rem) 190vw, 128rem" className={`${styles.zoomPhoto} ${zoomReady === current.key ? styles.zoomReady : ""}`} draggable={false} onLoad={(event) => {
                void decodeGalleryImage(event.currentTarget).then((decoded) => { if (decoded) setZoomReady(current.key); });
              }} />}
            </div>
          </div>
          <div className={styles.dialogFooter}>
            <button type="button" className={styles.iconButton} disabled={next === state.active} aria-label={labels.previous} onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
            <p aria-live="polite" aria-atomic="true">{busy ? <><LoaderCircle className={styles.spinner} aria-hidden="true" /><span className="srOnly">{labels.loading}</span></> : null}{current.label}</p>
            <button type="button" className={styles.iconButton} disabled={next === state.active} aria-label={labels.next} onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
          </div>
          {errorIndex !== null && <div className={styles.dialogError} role="status">{labels.unavailable} <button type="button" onClick={() => select(errorIndex)}>{labels.retry}</button></div>}
        </div>
      </Modal>}
    </div>
  );
}
