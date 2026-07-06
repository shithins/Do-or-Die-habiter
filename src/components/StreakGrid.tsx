import React from 'react';
import { Flame, Trophy, Check } from 'lucide-react';
import type { Habit, Completion } from '../utils/db';

interface StreakGridProps {
  habits: Habit[];
  completions: Completion[];
  weekDates: string[];
  isReadOnly: boolean;
  onCellClick: (habitId: string, habitName: string, date: string, isCompleted: boolean) => void;
  onDeleteHabit?: (habitId: string) => void;
}

export const StreakGrid: React.FC<StreakGridProps> = ({
  habits,
  completions,
  weekDates,
  isReadOnly,
  onCellClick,
  onDeleteHabit
}) => {
  const getCompletion = (habitId: string, date: string): Completion | undefined => {
    return completions.find(c => c.habit === habitId && c.date === date);
  };

  const getLocalDateString = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const calculateStreaks = (habitId: string) => {
    const dates = completions
      .filter(c => c.habit === habitId)
      .map(c => c.date)
      .filter((v, i, self) => self.indexOf(v) === i)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (dates.length === 0) {
      return { current: 0, longest: 0 };
    }

    const todayStr = getLocalDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let currentStreak = 0;
    const hasCompletedToday = dates.includes(todayStr);
    const hasCompletedYesterday = dates.includes(yesterdayStr);

    let expectedDate = new Date();

    if (hasCompletedToday) {
      currentStreak = 1;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (hasCompletedYesterday) {
      currentStreak = 1;
      expectedDate = yesterday;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      currentStreak = 0;
    }

    if (currentStreak > 0) {
      while (true) {
        const checkStr = getLocalDateString(expectedDate);
        if (dates.includes(checkStr)) {
          currentStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const sortedAsc = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    let longestStreak = 0;
    let tempStreak = 0;
    let prevTime: number | null = null;

    for (const dateStr of sortedAsc) {
      const currTime = new Date(dateStr).getTime();
      if (prevTime === null) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((currTime - prevTime) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      prevTime = currTime;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { current: currentStreak, longest: longestStreak };
  };

  const getDayLabel = (dateStr: string): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  const getDayNumber = (dateStr: string): string => {
    return dateStr.split('-')[2];
  };

  return (
    <div className="flex flex-col">
      {/* Grid Headers */}
      <div className="grid-header-row">
        <div className="flex-1 text-zinc-500">Habits</div>
        <div className="grid-cols-wrapper">
          {weekDates.map(date => (
            <div key={date} className="header-day-col">
              <span>{getDayLabel(date)}</span>
              <span className="text-zinc-600 mt-3" style={{ fontSize: '9px' }}>{getDayNumber(date)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Habit Rows */}
      {habits.length === 0 ? (
        <div className="habit-list-container" style={{ margin: '1rem 0' }}>
          <div className="habit-card justify-center text-zinc-500 text-sm" style={{ padding: '2rem' }}>
            No habits tracked here yet.
          </div>
        </div>
      ) : (
        <div className="habit-list-container">
          {habits.map(habit => {
            const { current, longest } = calculateStreaks(habit.id);

            return (
              <div key={habit.id} className="habit-card">
                {/* Info and stats */}
                <div className="habit-card-info">
                  <div className="habit-title-row">
                    <span className="habit-title">
                      {habit.name}
                    </span>
                    <span className="habit-category-badge">
                      {habit.category}
                    </span>
                  </div>

                  <div className="habit-stats-row">
                    <div className="stat-item text-orange-500">
                      <Flame size={13} fill="currentColor" className="fill-orange-500/20" />
                      <span>{current}</span>
                    </div>
                    <div className="stat-item text-zinc-500">
                      <Trophy size={13} />
                      <span>{longest}</span>
                    </div>
                  </div>
                </div>

                {/* Heatmap Grid Row */}
                <div className="grid-cols-wrapper relative select-none">
                  {weekDates.map((date, idx) => {
                    const comp = getCompletion(habit.id, date);
                    const isCompleted = !!comp;

                    let connectLeft = false;
                    let connectRight = false;

                    if (isCompleted) {
                      if (idx > 0) {
                        const prevDate = weekDates[idx - 1];
                        connectLeft = !!getCompletion(habit.id, prevDate);
                      }
                      if (idx < weekDates.length - 1) {
                        const nextDate = weekDates[idx + 1];
                        connectRight = !!getCompletion(habit.id, nextDate);
                      }
                    }

                    return (
                      <button
                        key={date}
                        disabled={isReadOnly}
                        onClick={() => onCellClick(habit.id, habit.name, date, isCompleted)}
                        className={`grid-cell ${isCompleted ? 'completed' : ''} ${
                          connectLeft ? 'connect-left' : ''
                        } ${connectRight ? 'connect-right' : ''}`}
                        title={`${habit.name} - ${date}${comp?.note ? `:\n"${comp.note}"` : ''}`}
                        aria-label={`Toggle ${habit.name} on ${date}`}
                      >
                        {isCompleted && !connectLeft && !connectRight && <Check size={14} strokeWidth={2.5} />}
                        {comp?.note && (
                          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-white rounded-full opacity-60" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Action buttons (Delete) on hover */}
                {!isReadOnly && onDeleteHabit && (
                  <button
                    onClick={() => onDeleteHabit(habit.id)}
                    className="btn-delete-habit"
                    title="Delete habit"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
