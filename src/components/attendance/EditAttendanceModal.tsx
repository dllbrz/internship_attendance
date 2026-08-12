// ============================================================================
// src/components/attendance/EditAttendanceModal.tsx
// "Edit Attendance Record" dialog.
// Choosing status "Absent" clears Time In / Time Out to --:-- and saves them
// blank with 0 hours. Any status can also be saved with blank times.
// ----------------------------------------------------------------------------
// IMPORTANT: adjust the supabase import to match your project.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  STATUS_OPTIONS,
  type AttendanceStatus,
  computeHours,
  normaliseAttendance,
  timeForInput,
} from "@/lib/attendanceSchedule";

export type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus | null;
  hours: number | null;
  credit_type?: string | null;
  full_name?: string;
  ojt_id?: string | null;
  break_minutes?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSaved?: () => void;
};

export default function EditAttendanceModal({ open, onClose, record, onSaved }: Props) {
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breakMinutes = record?.break_minutes ?? 60;
  const isAbsent = status === "absent";

  useEffect(() => {
    if (!open || !record) return;
    setTimeIn(timeForInput(record.time_in));
    setTimeOut(timeForInput(record.time_out));
    setStatus((record.status ?? "present") as AttendanceStatus);
    setError(null);
  }, [open, record]);

  // FIX #1 — selecting "Absent" blanks both times immediately in the UI.
  function handleStatusChange(next: AttendanceStatus) {
    setStatus(next);
    if (next === "absent") {
      setTimeIn("");
      setTimeOut("");
    }
  }

  const hours = useMemo(
    () => (isAbsent ? 0 : computeHours(timeIn, timeOut, breakMinutes)),
    [isAbsent, timeIn, timeOut, breakMinutes],
  );

  if (!open || !record) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Absent (or any blank time) is normalised here too, so the saved row can
    // never end up as "Absent" with 8 hours.
    const row = normaliseAttendance({
      time_in: timeIn,
      time_out: timeOut,
      status,
      credit_type: (record!.credit_type ?? null) as never,
      breakMinutes,
    });

    const { error: saveError } = await supabase
      .from("attendance")
      .update({
        time_in: row.time_in,
        time_out: row.time_out,
        status: row.status,
        hours: row.hours,
      })
      .eq("id", record!.id);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card text-card-foreground shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">Edit Attendance Record</h2>
          <button aria-label="Close" onClick={onClose} className="text-xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <p className="font-bold">
              {record.full_name}
              {record.ojt_id ? ` · ${record.ojt_id}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">{record.date}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              Time In
              <input
                type="time"
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={timeIn}
                disabled={isAbsent}
                onChange={(e) => setTimeIn(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Time Out
              <input
                type="time"
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={timeOut}
                disabled={isAbsent}
                onChange={(e) => setTimeOut(e.target.value)}
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setTimeIn("");
                setTimeOut("");
              }}
              disabled={isAbsent}
              className="rounded-md border px-3 py-1.5 font-medium disabled:opacity-50"
            >
              Set to --:-- (blank)
            </button>
            <span className="text-muted-foreground">
              Hours: <strong>{hours.toFixed(2)}</strong>
            </span>
          </div>

          <label className="block text-sm font-semibold">
            Status
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as AttendanceStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-muted-foreground">
            {isAbsent
              ? "Absent: time in / time out are cleared to --:-- and 0 hours are credited."
              : "Hours are recalculated from time in/out minus the intern's break. Leave a time blank (--:--) if the intern did not time out."}
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-md border px-4 py-2 font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
