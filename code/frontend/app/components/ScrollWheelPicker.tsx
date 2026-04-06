"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

type WheelColumnProps = {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  width?: string;
};

function WheelColumn({ items, selectedIndex, onChange, width = "auto" }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const scrollStartOffset = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const isSettling = useRef(false);

  const centreOffset = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

  const getTargetOffset = useCallback(
    (index: number) => -index * ITEM_HEIGHT,
    []
  );

  // Sync scroll position when selectedIndex changes externally
  useEffect(() => {
    if (!isDragging.current && !isSettling.current) {
      setScrollOffset(getTargetOffset(selectedIndex));
    }
  }, [selectedIndex, getTargetOffset]);

  const snapToNearest = useCallback(
    (currentOffset: number) => {
      const rawIndex = Math.round(-currentOffset / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(items.length - 1, rawIndex));
      const target = getTargetOffset(clampedIndex);

      isSettling.current = true;
      const startOffset = currentOffset;
      const startTime = performance.now();
      const duration = 420;

      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = startOffset + (target - startOffset) * eased;
        setScrollOffset(current);

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animate);
        } else {
          setScrollOffset(target);
          isSettling.current = false;
          if (clampedIndex !== selectedIndex) {
            onChange(clampedIndex);
          }
        }
      };

      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = requestAnimationFrame(animate);
    },
    [items.length, selectedIndex, onChange, getTargetOffset]
  );

  const momentumScroll = useCallback(
    (startOffset: number, startVelocity: number) => {
      isSettling.current = true;
      let offset = startOffset;
      let vel = startVelocity * 0.45;
      const friction = 0.92;

      const animate = () => {
        vel *= friction;
        offset += vel;

        // Clamp with rubber band
        const minOffset = getTargetOffset(items.length - 1);
        const maxOffset = 0;
        if (offset > maxOffset) offset = maxOffset;
        if (offset < minOffset) offset = minOffset;

        setScrollOffset(offset);

        if (Math.abs(vel) > 0.3) {
          animationFrame.current = requestAnimationFrame(animate);
        } else {
          snapToNearest(offset);
        }
      };

      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      animationFrame.current = requestAnimationFrame(animate);
    },
    [items.length, snapToNearest, getTargetOffset]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      isSettling.current = false;
      isDragging.current = true;
      dragStartY.current = e.clientY;
      scrollStartOffset.current = scrollOffset;
      lastY.current = e.clientY;
      lastTime.current = performance.now();
      velocity.current = 0;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [scrollOffset]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      const deltaY = e.clientY - dragStartY.current;
      const now = performance.now();
      const dt = now - lastTime.current;
      if (dt > 0) {
        velocity.current = (e.clientY - lastY.current) / dt * 16;
      }
      lastY.current = e.clientY;
      lastTime.current = now;

      let newOffset = scrollStartOffset.current + deltaY;
      // Rubber band at edges
      const minOffset = getTargetOffset(items.length - 1);
      if (newOffset > 0) newOffset = newOffset * 0.3;
      if (newOffset < minOffset) newOffset = minOffset + (newOffset - minOffset) * 0.3;

      setScrollOffset(newOffset);
    },
    [items.length, getTargetOffset]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (Math.abs(velocity.current) > 4) {
      momentumScroll(scrollOffset, velocity.current);
    } else {
      snapToNearest(scrollOffset);
    }
  }, [scrollOffset, momentumScroll, snapToNearest]);

  // Mouse wheel support
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      isSettling.current = false;

      const delta = e.deltaY > 0 ? 1 : -1;
      const newIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
      onChange(newIndex);
      // Animate to the new position instead of jumping
      snapToNearest(getTargetOffset(newIndex) + delta * 2);
    },
    [items.length, selectedIndex, onChange, getTargetOffset, snapToNearest]
  );

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden"
      style={{ height: PICKER_HEIGHT, width, touchAction: "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <div
        className="absolute left-0 right-0"
        style={{ top: centreOffset, transform: `translateY(${scrollOffset}px)` }}
      >
        {items.map((item, index) => {
          const distFromCentre = Math.abs(index * ITEM_HEIGHT + scrollOffset) / ITEM_HEIGHT;
          const scale = Math.max(0.75, 1 - distFromCentre * 0.12);
          const opacity = Math.max(0.25, 1 - distFromCentre * 0.3);
          return (
            <div
              key={`${item}-${index}`}
              className="flex items-center justify-center font-semibold"
              style={{
                height: ITEM_HEIGHT,
                fontSize: distFromCentre < 0.6 ? "1.35rem" : "1.05rem",
                opacity,
                transform: `scale(${scale})`,
                transition: isDragging.current ? "none" : "font-size 0.15s",
                color: distFromCentre < 0.6 ? "var(--foreground)" : "var(--muted)",
              }}
            >
              {item}
            </div>
          );
        })}
      </div>

      {/* Fade top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: centreOffset,
          background: "linear-gradient(to bottom, var(--surface-strong), transparent)",
        }}
      />
      {/* Fade bottom */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{
          height: centreOffset,
          background: "linear-gradient(to top, var(--surface-strong), transparent)",
        }}
      />
      {/* Selection indicator */}
      <div
        className="pointer-events-none absolute inset-x-2 z-10 rounded-xl border border-[var(--outline)]"
        style={{
          top: centreOffset,
          height: ITEM_HEIGHT,
          background: "var(--surface-soft)",
          opacity: 0.45,
        }}
      />
    </div>
  );
}

// ── Build date labels ─────────────────────────────────────────────────────────

function buildDateItems(centreDate: Date, range: number = 14): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  const today = new Date(centreDate);
  today.setHours(0, 0, 0, 0);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let offset = -3; offset <= range; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;

    if (offset === 0) {
      items.push({ label: "Today", value });
    } else if (offset === 1) {
      items.push({ label: "Tomorrow", value });
    } else if (offset === -1) {
      items.push({ label: "Yesterday", value });
    } else {
      items.push({ label: `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`, value });
    }
  }
  return items;
}

function buildHourItems(): { label: string; value: number }[] {
  return Array.from({ length: 24 }, (_, i) => ({
    label: String(i).padStart(2, "0"),
    value: i,
  }));
}

function buildMinuteItems(): { label: string; value: number }[] {
  return Array.from({ length: 60 }, (_, i) => ({
    label: String(i).padStart(2, "0"),
    value: i,
  }));
}

// ── Main picker component ─────────────────────────────────────────────────────

type DateTimeWheelPickerProps = {
  date: string;
  time: string;
  onConfirm: (date: string, time: string) => void;
  onClose: () => void;
  open: boolean;
};

export default function DateTimeWheelPicker({ date, time, onConfirm, onClose, open }: DateTimeWheelPickerProps) {
  const now = new Date();
  const dateItems = buildDateItems(now);
  const hourItems = buildHourItems();
  const minuteItems = buildMinuteItems();

  const [hh, mm] = time.split(":").map(Number);

  const initialDateIndex = Math.max(0, dateItems.findIndex((item) => item.value === date));
  const [dateIndex, setDateIndex] = useState(initialDateIndex);
  const [hourIndex, setHourIndex] = useState(hh || 0);
  const [minuteIndex, setMinuteIndex] = useState(mm || 0);

  // Reset when opened with new props
  useEffect(() => {
    if (open) {
      const idx = Math.max(0, dateItems.findIndex((item) => item.value === date));
      setDateIndex(idx);
      const [h, m] = time.split(":").map(Number);
      setHourIndex(h || 0);
      setMinuteIndex(m || 0);
    }
  }, [open, date, time]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    const selectedDate = dateItems[dateIndex]?.value ?? date;
    const selectedTime = `${String(hourItems[hourIndex].value).padStart(2, "0")}:${String(minuteItems[minuteIndex].value).padStart(2, "0")}`;
    onConfirm(selectedDate, selectedTime);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[900] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[901] animate-[slideUp_0.3s_ease-out] rounded-t-[1.75rem] border-t border-[var(--outline)] bg-[var(--surface-strong)] px-4 pb-8 pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.25)]">
        {/* Drag handle */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--muted)] opacity-40" />

        {/* Header */}
        <div className="mb-2 flex items-center justify-between border-b border-[var(--outline)] pb-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-[var(--brand-ink)]">
            Departure
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            className="text-sm font-semibold text-[var(--brand)] transition hover:text-[var(--brand-ink)]"
          >
            Done
          </button>
        </div>

        {/* Wheel columns */}
        <div className="flex items-center gap-1">
          <div className="flex-[1.4]">
            <WheelColumn
              items={dateItems.map((d) => d.label)}
              selectedIndex={dateIndex}
              onChange={setDateIndex}
            />
          </div>
          <div className="flex-[0.6]">
            <WheelColumn
              items={hourItems.map((h) => h.label)}
              selectedIndex={hourIndex}
              onChange={setHourIndex}
            />
          </div>
          <span className="pb-0.5 text-xl font-bold text-[var(--foreground)]">:</span>
          <div className="flex-[0.6]">
            <WheelColumn
              items={minuteItems.map((m) => m.label)}
              selectedIndex={minuteIndex}
              onChange={setMinuteIndex}
            />
          </div>
        </div>

        {/* Confirm button */}
        <button
          type="button"
          onClick={handleConfirm}
          className="mt-4 w-full rounded-2xl bg-[var(--brand)] py-4 text-base font-bold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)]"
        >
          Confirm
        </button>
      </div>
    </>
  );
}
