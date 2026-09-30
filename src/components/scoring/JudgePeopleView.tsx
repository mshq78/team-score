import React, { useMemo, useState } from 'react';
import type { AppState } from '../../store/state';
import type { AppAction } from '../../store/actions';
import { toPersianDigits } from '../../utils/persian';
import { sound } from '../../utils/sound';
import { SyncBadge } from '../SyncBadge';
import { ChevronRight, LogOut } from 'lucide-react';

interface Props {
  state: AppState;
  judgeId: string;
  dispatch: React.Dispatch<AppAction>;
  onBack: () => void;
  onLogout: () => void;
}

/** Judge phone screen: score each person on the event's criteria (kept apart from team scores). */
export const JudgePeopleView: React.FC<Props> = ({ state, judgeId, dispatch, onBack, onLogout }) => {
  const criteria = state.scoring.personCriteria ?? [];
  const scores = state.scoring.personScores ?? {};
  const groups = useMemo(() => {
    const byId = new Map(state.participants.map((p) => [p.id, p]));
    const placed = new Set<string>();
    const list = state.teams
      .map((t) => ({
        id: t.id,
        name: t.name,
        dot: t.badgeBg || 'bg-slate-400',
        people: t.memberIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p),
      }))
      .filter((g) => g.people.length > 0);
    list.forEach((g) => g.people.forEach((p) => placed.add(p.id)));
    const rest = state.participants.filter((p) => !placed.has(p.id));
    if (rest.length) list.push({ id: '__rest', name: 'بدون تیم', dot: 'bg-slate-500', people: rest });
    return list;
  }, [state.participants, state.teams]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  const valueOf = (participantId: string, criterionId: string) =>
    scores[`${judgeId}|${participantId}|${criterionId}`]?.value ?? null;

  const setValue = (participantId: string, criterionId: string, value: number | null) => {
    dispatch({
      type: 'SET_PERSON_SCORE',
      payload: { judgeId, participantId, criterionId, value, updatedAt: new Date().toISOString() },
    });
    sound.playClick();
  };

  const isDone = (participantId: string) => criteria.length > 0 && criteria.every((c) => valueOf(participantId, c.id) !== null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] max-w-lg mx-auto pb-24">
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white cursor-pointer">
          <ChevronRight className="w-4 h-4" />
          <span>بازگشت</span>
        </button>
        <div className="text-sm font-black text-rose-300">ارزیابی افراد</div>
        <SyncBadge compact />
        <button onClick={onLogout} className="text-xs text-slate-400 hover:text-rose-400 p-1 cursor-pointer" title="خروج">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {criteria.length === 0 || groups.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-400">
          {criteria.length === 0 ? 'اپراتور هنوز معیاری برای ارزیابی افراد تعریف نکرده است.' : 'هنوز فردی ثبت نشده است.'}
        </p>
      ) : (
        <>
          <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/80 overflow-x-auto flex items-center gap-2">
            {groups.map((g) => {
              const selected = g.id === group.id;
              const complete = g.people.every((p) => isDone(p.id));
              return (
                <button
                  key={g.id}
                  onClick={() => setGroupId(g.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${
                    selected ? 'bg-rose-500 text-white border-rose-400 font-black' : 'bg-slate-900 text-slate-300 border-slate-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${g.dot}`} />
                  <span>{g.name}</span>
                  {complete && <span className={selected ? 'text-white' : 'text-emerald-400'}>✓</span>}
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4">
            {group.people.map((p) => (
              <div key={p.id} className={`rounded-2xl border p-4 space-y-3 ${isDone(p.id) ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/70'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white">{p.name}</h3>
                  {isDone(p.id) && <span className="text-xs text-emerald-400 font-bold">✓ کامل</span>}
                </div>
                {criteria.map((c) => {
                  const v = valueOf(p.id, c.id);
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-bold">{c.name}</span>
                        <span className="text-slate-500 font-mono">{v === null ? '—' : toPersianDigits(v)} / {toPersianDigits(c.maxScore)}</span>
                      </div>
                      {c.maxScore <= 10 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: c.maxScore + 1 }, (_, n) => (
                            <button
                              key={n}
                              onClick={() => setValue(p.id, c.id, v === n ? null : n)}
                              className={`min-w-9 h-9 px-2 rounded-lg text-sm font-mono font-bold cursor-pointer border ${
                                v === n ? 'bg-rose-500 border-rose-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'
                              }`}
                            >
                              {toPersianDigits(n)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={c.maxScore}
                          value={v ?? ''}
                          onChange={(e) => {
                            if (e.target.value === '') return setValue(p.id, c.id, null);
                            const n = Number(e.target.value);
                            if (Number.isInteger(n) && n >= 0 && n <= c.maxScore) setValue(p.id, c.id, n);
                          }}
                          className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
