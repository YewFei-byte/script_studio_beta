import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarCheck2, CalendarClock } from 'lucide-react';
import Modal from './Modal';
import { GlassButton } from './Glass';
import { platformMeta } from '../data/mockData';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Read-only calendar of every scheduled post, so you can see everything
// that's queued up at a glance instead of hunting through the Post list.
// Scheduling a post now also auto-creates a real Google Calendar event (see
// src/utils/googleCalendarSync.js, wired in from AdminPanel.jsx) if a Google
// account is connected via User Setting → Google Calendar — no click
// required here anymore. The badge below just reflects whether that sync
// actually happened for each item (item.gcalEventId).
export default function PostCalendarModal({ content, onClose }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);

  const scheduled = useMemo(
    () => content.filter((c) => c.status === 'scheduled' && c.scheduledAt && !Number.isNaN(new Date(c.scheduledAt).getTime())),
    [content]
  );

  const byDay = useMemo(() => {
    const map = {};
    scheduled.forEach((item) => {
      const key = dateKey(new Date(item.scheduledAt));
      (map[key] = map[key] || []).push(item);
    });
    return map;
  }, [scheduled]);

  const today = new Date();
  const viewMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const selectedItems = selectedDay ? byDay[selectedDay] || [] : [];

  return (
    <Modal open onClose={onClose} width={560}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Scheduled posts</h2>
      <p style={{ color: 'var(--ink-500)', fontSize: 12.5, marginBottom: 18 }}>
        Everything queued up to auto-publish. Click a day to see what's on it.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setMonthOffset((m) => m - 1)} style={navBtn}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{monthLabel}</span>
        <button onClick={() => setMonthOffset((m) => m + 1)} style={navBtn}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-300)', padding: '4px 0' }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = dateKey(d);
          const items = byDay[key] || [];
          const isToday = dateKey(today) === key;
          const isSelected = selectedDay === key;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(items.length ? key : null)}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
                border: isSelected ? '1.5px solid var(--accent-violet)' : isToday ? '1.5px solid rgba(242,170,36,0.5)' : '1px solid transparent',
                background: items.length ? 'rgba(242,170,36,0.12)' : 'transparent',
                cursor: items.length ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: 12,
                color: 'var(--ink-900)',
                padding: 2,
              }}
            >
              <span>{d.getDate()}</span>
              {items.length > 0 && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-violet)' }} />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {selectedItems.map((item) => {
            const time = new Date(item.scheduledAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            return (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'var(--glass-fill-soft)', border: '1px solid var(--glass-border)' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CalendarClock size={11} /> {time} · {platformMeta[item.kind]?.label || item.kind}
                  </div>
                </div>
                {item.gcalEventId ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--accent-mint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <CalendarCheck2 size={12} /> On Google Calendar
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--ink-300)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Not synced
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : scheduled.length === 0 ? (
        <p style={{ color: 'var(--ink-300)', fontSize: 13 }}>Nothing scheduled yet — dots will show up here once you schedule a post.</p>
      ) : (
        <p style={{ color: 'var(--ink-300)', fontSize: 13 }}>Click a highlighted day to see what's scheduled.</p>
      )}

      <GlassButton variant="ghost" style={{ justifyContent: 'center', width: '100%', marginTop: 20 }} onClick={onClose}>
        Close
      </GlassButton>
    </Modal>
  );
}

const navBtn = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '1px solid var(--glass-border)',
  background: 'var(--glass-fill-soft)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--ink-700)',
};
