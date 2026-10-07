"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// Confirmations can open above an editor or drawer. Releasing both together
// must restore scrolling only after the final dialog has closed.
let scrollLocks = 0;
type InlineStyle = { value: string; priority: string };
let bodyLock: {
  element: HTMLElement;
  overflow: InlineStyle;
  padding: InlineStyle;
  appliedPadding: string | null;
} | null = null;

function lockScrolling() {
  if (scrollLocks === 0) {
    const element = document.body;
    bodyLock = {
      element,
      overflow: { value: element.style.getPropertyValue("overflow"), priority: element.style.getPropertyPriority("overflow") },
      padding: { value: element.style.getPropertyValue("padding-right"), priority: element.style.getPropertyPriority("padding-right") },
      appliedPadding: null,
    };
    const previousWidth = document.documentElement.clientWidth;
    const previousPadding = Number.parseFloat(getComputedStyle(element).paddingRight) || 0;
    element.style.setProperty("overflow", "hidden");
    // Compensate only for space actually released by hiding the scrollbar.
    // A stable scrollbar gutter therefore does not receive extra padding.
    const releasedWidth = document.documentElement.clientWidth - previousWidth;
    if (releasedWidth > 0) {
      element.style.setProperty("padding-right", `${previousPadding + releasedWidth}px`);
      bodyLock.appliedPadding = element.style.getPropertyValue("padding-right");
    }
  }
  scrollLocks += 1;
}

function restoreStyle(element: HTMLElement, property: string, original: InlineStyle) {
  if (original.value) element.style.setProperty(property, original.value, original.priority);
  else element.style.removeProperty(property);
}

function unlockScrolling() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks !== 0 || !bodyLock) return;
  const { element, overflow, padding, appliedPadding } = bodyLock;
  // Preserve any style intentionally changed elsewhere while the modal was open.
  if (element.style.getPropertyValue("overflow") === "hidden" && !element.style.getPropertyPriority("overflow")) restoreStyle(element, "overflow", overflow);
  if (appliedPadding !== null && element.style.getPropertyValue("padding-right") === appliedPadding && !element.style.getPropertyPriority("padding-right")) restoreStyle(element, "padding-right", padding);
  bodyLock = null;
}

function animationTime(value: string) {
  const number = Number.parseFloat(value) || 0;
  return value.trim().endsWith("ms") ? number : number * 1000;
}

function exitDuration(dialog: HTMLDialogElement) {
  const style = getComputedStyle(dialog);
  const durations = style.animationDuration.split(",").map(animationTime);
  const delays = style.animationDelay.split(",").map(animationTime);
  return Math.max(0, ...durations.map((duration, index) => duration + (delays[index % delays.length] ?? 0)));
}

export function Modal({ children, label, className, onClose, id, open = true, animate = false, onAfterClose, initialFocusRef }: {
  children: ReactNode;
  label: string;
  className: string;
  onClose: () => void;
  id?: string;
  open?: boolean;
  animate?: boolean;
  onAfterClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const callbacks = useRef({ onClose, onAfterClose });
  const lifecycle = useRef<{ previous: HTMLElement | null; locked: boolean; cancelExit: (() => void) | null }>({ previous: null, locked: false, cancelExit: null });

  useEffect(() => { callbacks.current = { onClose, onAfterClose }; }, [onClose, onAfterClose]);

  useEffect(() => {
    const dialog = ref.current;
    const current = lifecycle.current;
    return () => {
      current.cancelExit?.();
      dialog?.close();
      if (current.locked) { current.locked = false; unlockScrolling(); }
      if (current.previous?.isConnected) current.previous.focus({ preventScroll: true });
      current.previous = null;
    };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const current = lifecycle.current;
    current.cancelExit?.();
    current.cancelExit = null;

    if (open) {
      if (!dialog.open) {
        current.previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
        lockScrolling();
        current.locked = true;
        if (initialFocusRef?.current && dialog.contains(initialFocusRef.current)) initialFocusRef.current.focus({ preventScroll: true });
      }
      dialog.dataset.phase = "open";
      return;
    }
    if (!dialog.open) { dialog.dataset.phase = "closed"; return; }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      current.cancelExit = null;
      dialog.close();
      dialog.dataset.phase = "closed";
      if (current.locked) { current.locked = false; unlockScrolling(); }
      if (current.previous?.isConnected) current.previous.focus({ preventScroll: true });
      current.previous = null;
      callbacks.current.onAfterClose?.();
    };
    const cancel = () => { cancelled = true; if (timer !== null) clearTimeout(timer); };
    current.cancelExit = cancel;
    dialog.dataset.phase = "closing";

    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    // getAnimations() flushes the phase's CSS change and excludes descendants.
    // Keep the native modal active until its own slide/fade finishes.
    const animations = dialog.getAnimations().filter((animation) => animation.playState !== "finished" && animation.playState !== "idle");
    if (!animations.length) { finish(); return; }
    timer = setTimeout(finish, Math.min(exitDuration(dialog), 1000) + 80);
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
    return cancel;
  }, [open, animate, initialFocusRef]);

  return <dialog ref={ref} id={id} aria-label={label} className={className} data-phase="closed" onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const dialog = event.currentTarget;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    const active = document.activeElement;
    // Announcements and Undo may focus a heading with tabindex=-1. From there,
    // both directions must enter the modal's controls rather than browser chrome.
    const outsideTabOrder = !controls.some((element) => element === active);
    if (event.shiftKey && (active === first || outsideTabOrder)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (active === last || outsideTabOrder)) { event.preventDefault(); first.focus(); }
  }} onCancel={(event) => { event.preventDefault(); callbacks.current.onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) callbacks.current.onClose(); } }}>{children}</dialog>;
}
