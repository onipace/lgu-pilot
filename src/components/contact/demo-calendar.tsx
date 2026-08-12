'use client';

// src/components/contact/demo-calendar.tsx — CR-001 Demo Booking System
// Calendar date strip + time slot picker for demo booking

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

interface DemoCalendarProps {
  onSlotSelect: (date: string, slot: string) => void;
  selectedDate?: string;
  selectedSlot?: string;
}

interface DaySlots {
  date: string;
  dayLabel: string;
  slots: string[];
}

export default function DemoCalendar({ onSlotSelect, selectedDate, selectedSlot }: DemoCalendarProps) {
  const [availableDays, setAvailableDays] = useState<DaySlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDate, setActiveDate] = useState<string>(selectedDate || "");
  const [activeSlot, setActiveSlot] = useState<string>(selectedSlot || "");
  const [scrollRef, setScrollRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/demo-slots")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.dates) {
          setAvailableDays(data.dates);
          // Auto-select first date if none selected
          if (!activeDate && data.dates.length > 0) {
            setActiveDate(data.dates[0].date);
          }
        }
      })
      .catch((err) => console.error("[demo-calendar] Failed to fetch slots:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleDateSelect = (date: string) => {
    setActiveDate(date);
    setActiveSlot(""); // Reset slot when changing date
  };

  const handleSlotSelect = (slot: string) => {
    setActiveSlot(slot);
    onSlotSelect(activeDate, slot);
  };

  const selectedDay = availableDays.find((d) => d.date === activeDate);

  const scrollDates = (direction: "left" | "right") => {
    if (scrollRef) {
      const amount = direction === "left" ? -160 : 160;
      scrollRef.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return { day: d.toLocaleDateString("en-PH", { weekday: "short" }), date: d.getDate() };
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-[hsl(var(--pillar-muted)/0.2)]" />
        <div className="flex gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-16 w-14 animate-pulse rounded-lg bg-[hsl(var(--pillar-muted)/0.2)]" />
          ))}
        </div>
      </div>
    );
  }

  if (availableDays.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-6 text-center">
        <Clock className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--pillar-muted)/0.4)]" />
        <p className="text-sm font-medium text-[hsl(var(--pillar-muted))]">No available slots at the moment</p>
        <p className="mt-1 text-xs text-[hsl(var(--pillar-muted)/0.6)]">Please check back later or submit without selecting a time.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-surface))] p-4 sm:p-6">
      {/* Date strip header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[hsl(var(--pillar-text))]">Select a Date</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => scrollDates("left")}
            className="rounded-lg border border-[hsl(var(--pillar-border))] p-1.5 text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollDates("right")}
            className="rounded-lg border border-[hsl(var(--pillar-border))] p-1.5 text-[hsl(var(--pillar-muted))] transition-colors hover:text-[hsl(var(--pillar-text))]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Date strip */}
      <div
        ref={setScrollRef}
        className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {availableDays.map((day) => {
          const { day: dayName, date: dateNum } = formatDateShort(day.date);
          const isSelected = day.date === activeDate;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => handleDateSelect(day.date)}
              className={`flex min-w-[56px] flex-col items-center rounded-xl border px-3 py-2 transition-all ${
                isSelected
                  ? "border-[hsl(var(--pillar-primary))] bg-[hsl(var(--pillar-primary))] text-white shadow-sm"
                  : "border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))] hover:border-[hsl(var(--pillar-primary)/0.4)]"
              }`}
            >
              <span className={`text-[10px] font-semibold uppercase ${isSelected ? "text-white/80" : "text-[hsl(var(--pillar-muted))]"}`}>
                {dayName}
              </span>
              <span className="text-lg font-bold">{dateNum}</span>
              <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-[hsl(var(--pillar-muted)/0.6)]"}`}>
                {day.slots.length} slots
              </span>
            </button>
          );
        })}
      </div>

      {/* Time slots */}
      {selectedDay && (
        <>
          <h3 className="mb-2 text-sm font-bold text-[hsl(var(--pillar-text))]">
            Available Times — {selectedDay.dayLabel}
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedDay.slots.map((slot) => {
              const isSelected = slot === activeSlot;
              // Format time for display (24h → 12h)
              const [h, m] = slot.split(":").map(Number);
              const period = h >= 12 ? "PM" : "AM";
              const displayH = h % 12 || 12;
              const displayTime = `${displayH}:${String(m).padStart(2, "0")} ${period}`;

              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-[hsl(var(--pillar-primary))] bg-[hsl(var(--pillar-primary))] text-white"
                      : "border-[hsl(var(--pillar-border))] bg-[hsl(var(--pillar-bg))] text-[hsl(var(--pillar-text))] hover:border-[hsl(var(--pillar-primary)/0.4)] hover:bg-[hsl(var(--pillar-primary)/0.05)]"
                  }`}
                >
                  {displayTime}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
