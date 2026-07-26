import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { Workshop } from '../data/workshops';
import type { Trainer } from '../data/trainers';
import type { Participant } from '../data/participants';
import type { FeedbackResponse } from '../data/feedback';
import { fetchWorkshops, fetchTrainers, fetchParticipants, fetchFeedback, saveWorkshopAttendance } from '../data/api';

type DataContextValue = {
  workshops: Workshop[];
  setWorkshops: Dispatch<SetStateAction<Workshop[]>>;
  trainers: Trainer[];
  setTrainers: Dispatch<SetStateAction<Trainer[]>>;
  participants: Participant[];
  setParticipants: Dispatch<SetStateAction<Participant[]>>;
  feedback: FeedbackResponse[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  // Persists a workshop edit. If it's an attendance change (the "الحضور" tab's participant
  // roster differs from what's on record), it's saved through the backend's batch attendance
  // endpoint — which recomputes every aggregate server-side and writes it into the real Excel
  // file — and both `workshops` and `participants` are refreshed from that authoritative
  // response. Other workshop-detail edits (photos, report notes) have no backing column in the
  // source Excel sheets, so they update local state only.
  updateWorkshop: (updated: Workshop) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [feedback, setFeedback] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const { signal } = controller;
        const [w, t, p, f] = await Promise.all([
          fetchWorkshops(signal),
          fetchTrainers(signal),
          fetchParticipants(signal),
          fetchFeedback(signal),
        ]);
        setWorkshops(w);
        setTrainers(t);
        setParticipants(p);
        setFeedback(f);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return; // effect cleanup (e.g. React StrictMode's dev double-mount), not a real failure
        console.error('Failed to load data from the backend.', err);
        setWorkshops([]);
        setTrainers([]);
        setParticipants([]);
        setFeedback([]);
        setError('تعذّر الاتصال بالخادم. تأكد من تشغيل الخادم الخلفي (backend) ثم أعد المحاولة.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => {
      controller.abort();
    };
  }, [reloadToken]);

  const value = useMemo<DataContextValue>(
    () => ({
      workshops,
      setWorkshops,
      trainers,
      setTrainers,
      participants,
      setParticipants,
      feedback,
      loading,
      error,
      reload: () => setReloadToken((n) => n + 1),
      updateWorkshop: async (updated: Workshop) => {
        const current = workshops.find((w) => w.workshop_id === updated.workshop_id);
        const currentById = new Map((current?.participants ?? []).map((p) => [p.participant_id, p]));
        const changedEntries = updated.participants
          .filter((wp) => {
            const before = currentById.get(wp.participant_id);
            return before && JSON.stringify(wp.sessionAttendance) !== JSON.stringify(before.sessionAttendance);
          })
          .map((wp) => ({
            participant_id: wp.participant_id,
            day_1: wp.sessionAttendance[0],
            day_2: wp.sessionAttendance[1],
            day_3: wp.sessionAttendance[2],
            day_4: wp.sessionAttendance[3],
            day_5: wp.sessionAttendance[4],
          }));

        if (changedEntries.length === 0) {
          setWorkshops((list) => list.map((w) => (w.workshop_id === updated.workshop_id ? updated : w)));
          return;
        }

        try {
          const refreshed = await saveWorkshopAttendance(updated.workshop_id, changedEntries);
          setWorkshops((list) => list.map((w) => (w.workshop_id === refreshed.workshop_id ? refreshed : w)));
          setParticipants(await fetchParticipants());
        } catch (err) {
          console.error('Failed to save attendance to the backend.', err);
          throw err;
        }
      },
    }),
    [workshops, trainers, participants, feedback, loading, error],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
