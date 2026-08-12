// ============================================================================
// src/components/attendance/AddScheduleModal.tsx
// "Add Schedule for an Intern" dialog.
// Adds the "Suspension" schedule type and allows blank (--:--) times.
// ----------------------------------------------------------------------------
// IMPORTANT: adjust the supabase import on the next line to match your project
// (commonly "@/lib/supabase", "@/lib/supabaseClient" or
//  "@/integrations/supabase/client").
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  SCHEDULE_TYPES,
  type CreditType,
  computeHours,
  isAbsenceType,
  normaliseAttendance,
} from "@/lib/attendanceSchedule";

type Intern = {
  id: string;
  full_name: string;
  ojt_id: string | null;
  break_minutes?: number | null;
  shift_start?: string | null;
  shift_end?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Date the schedule is being added for, "YYYY-MM-DD". */
  date: string;
  interns: Intern[];
  /** Called after a successful save so the parent can refresh the table. */
  onSaved?: () => void;
};

export default function AddScheduleModal({
  open,
  onClose,
  date,
  interns,
  onSaved,
}: Props) {
  const [internId, setInternId] = useState("");
  const [creditType, setCreditType] = useState<CreditType>("regular");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intern = useMemo(
    () => interns.find((i) => i.id === internId) ?? null,
    [interns, internId],
  );
  const breakMinutes = intern?.break_minutes ?? 60;
  const absence = isAbsenceType(creditType);

  // Reset when reopened.
  useEffect(() => {
    if (!open) return;
    setInternId(interns[0]?.id ?? "");
    setCreditType("regular");
    setNote("");
    setError(null);
  }, [open, interns]);

  // Prefill the intern's shift, but never for an absence type.
  useEffect(() => {
    if (absence) {
      setTimeIn("");
      setTimeOut("");
      return;
    }
    setTimeIn((prev) => prev || intern?.shift_start?.slice(0, 5) || "08:00");
    setTimeOut((prev) => prev || intern?.shift_end?.slice(0, 5) || "17:00");
  }, [absence, intern]);

  if (!open) return null;

  const previewHours = absence ? 0 : computeHours(timeIn, timeOut, breakMinutes);

  async function handleSave() {
    if (!internId) {
      setError("Please choose an intern.");
      return;
    }
    setSaving(true);
    setError(null);

    const row = normaliseAttendance({
      time_in: timeIn,
      time_out: timeOut,
      // For non-absence types the day is attended.
      status: absence ? "absent" : "present",
      credit_type: creditType,
      breakMinutes,
    });

    const { data: auth } = await supabase.auth.getUser();

    const { error: saveError } = await supabase.from("attendance").upsert(
      {
        student_id: internId,
        date,
        time_in: row.time_in,
        time_out: row.time_out,
        status: row.status,
        hours: row.hours,
        credit_type: row.credit_type,
        note: note.trim() || null,
        credited_by: auth?.user?.id ?? null,
      },
      { onConflict: "student_id,date" },
    );

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
      <div className="w-full max-w-lg rounded-xl bg-card text-card-foreground shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold">Add Schedule for an Intern</h2>
          <button aria-label="Close" onClick={onClose} className="text-xl leading-none">
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            Use this to record a <strong>Regular day</strong> that was not scanned, or to
            grant a rest day, reward, holiday or off-site day — those hours are still
            credited. Choose <strong>Excused (Not Credited)</strong>,{" "}
            <strong>Absent</strong> or <strong>Suspension</strong> to record a day with no
            rendered hours: time in / time out stay blank (--:--) and the day counts as an
            absence everywhere.
          </p>

          <label className="block text-sm font-semibold">
            Intern
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={internId}
              onChange={(e) => setInternId(e.target.value)}
            >
              {interns.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.full_name}
                  {i.ojt_id ? ` — ${i.ojt_id}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Schedule type
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={creditType}
              onChange={(e) => setCreditType(e.target.value as CreditType)}
            >
              {SCHEDULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              Time In
              <input
                type="time"
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={timeIn}
                disabled={absence}
                onChange={(e) => setTimeIn(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Time Out
              <input
                type="time"
                className="mt-1 w-full rounded-md border px-3 py-2 disabled:opacity-60"
                value={timeOut}
                disabled={absence}
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
              disabled={absence}
              className="rounded-md border px-3 py-1.5 font-medium disabled:opacity-50"
            >
              Set to --:-- (blank)
            </button>
            <span className="text-muted-foreground">
              Credited hours: <strong>{previewHours.toFixed(2)}</strong>
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Leave a time blank (--:--) when the intern did not time out — no hours are
            credited for that day.
          </p>

          <label className="block text-sm font-semibold">
            Reason / note (optional)
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Suspension of Work — Typhoon"
            />
          </label>

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
            {saving ? "Saving…" : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
