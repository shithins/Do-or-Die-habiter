import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar, Heart, Award } from 'lucide-react';
import type { Habit, Completion } from '../utils/db';

interface ChartsDashboardProps {
  habits: Habit[];
  completions: Completion[];
  currentUser: { id: string; username: string; name: string };
  usersList: { id: string; username: string; name: string }[];
}

const getLocalDateString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const ChartsDashboard: React.FC<ChartsDashboardProps> = ({
  habits,
  completions,
  currentUser,
  usersList
}) => {
  // Stats user toggle
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.id);
  const targetUser = useMemo(() => 
    usersList.find(u => u.id === selectedUserId) || currentUser, 
    [usersList, selectedUserId, currentUser]
  );

  // Filter data for target user
  const userHabits = useMemo(() => habits.filter(h => h.user === selectedUserId), [habits, selectedUserId]);
  const userHabitIds = useMemo(() => userHabits.map(h => h.id), [userHabits]);
  const userCompletions = useMemo(() => completions.filter(c => userHabitIds.includes(c.habit)), [completions, userHabitIds]);

  // Selected habit for detail view
  const [selectedHabitId, setSelectedHabitId] = useState<string>('all');

  const selectedHabit = useMemo(() => 
    userHabits.find(h => h.id === selectedHabitId), 
    [userHabits, selectedHabitId]
  );

  // --- Calculations ---

  // 1. Completion Rate over last 28 days (4 weeks)
  const stats = useMemo(() => {
    if (userHabits.length === 0) return { totalCompletions: 0, completionRate: 0 };
    const totalCompletions = userCompletions.length;
    const past28DaysCompletions = userCompletions.filter(c => {
      const diffTime = Math.abs(new Date().getTime() - new Date(c.date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 28;
    }).length;

    const rate = Math.round((past28DaysCompletions / (userHabits.length * 28)) * 100);
    return {
      totalCompletions,
      completionRate: Math.min(rate, 100)
    };
  }, [userHabits, userCompletions]);

  // 2. Weekly Consistency (Last 4 Weeks)
  const consistencyData = useMemo(() => {
    const dataPoints: { label: string; rate: number }[] = [];
    if (userHabits.length === 0) return [{ label: 'W1', rate: 0 }, { label: 'W2', rate: 0 }, { label: 'W3', rate: 0 }, { label: 'W4', rate: 0 }];

    for (let w = 3; w >= 0; w--) {
      const start = new Date();
      start.setDate(start.getDate() - (w * 7 + 6));
      start.setHours(0, 0, 0, 0);

      const end = new Date();
      end.setDate(end.getDate() - (w * 7));
      end.setHours(23, 59, 59, 999);

      const weekComps = userCompletions.filter(c => {
        const d = new Date(c.date);
        return d >= start && d <= end;
      }).length;

      const rate = Math.round((weekComps / (userHabits.length * 7)) * 100);
      dataPoints.push({
        label: `Wk ${4 - w}`,
        rate: Math.min(rate, 100)
      });
    }
    return dataPoints;
  }, [userHabits, userCompletions]);

  // 3. Weekly Distribution (Completions by Day of the Week)
  const distributionData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    userCompletions.forEach(c => {
      const d = new Date(c.date);
      const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      if (dayIdx >= 0 && dayIdx < 7) {
        counts[dayIdx]++;
      }
    });

    return days.map((day, idx) => ({
      day,
      count: counts[idx]
    }));
  }, [userCompletions]);

  // 4. Metric Line Chart Data (Last 14 days)
  const metricTimelineData = useMemo(() => {
    const timeline: { dateLabel: string; dateStr: string; value: number; completed: boolean }[] = [];
    const targetHabitId = selectedHabitId;

    if (targetHabitId === 'all') return [];

    const selectedUnit = selectedHabit?.unit;
    const isNumeric = !!selectedUnit;

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      
      const comp = userCompletions.find(c => c.habit === targetHabitId && c.date === dateStr);
      
      let val = 0;
      if (comp) {
        if (isNumeric && comp.value !== undefined) {
          val = comp.value;
        } else {
          val = 1; // default to 1 if binary checked
        }
      }

      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timeline.push({
        dateLabel,
        dateStr,
        value: val,
        completed: !!comp
      });
    }
    return timeline;
  }, [selectedHabitId, selectedHabit, userCompletions]);

  // Max value for metric chart scaling
  const metricMax = useMemo(() => {
    if (metricTimelineData.length === 0) return 10;
    const vals = metricTimelineData.map(d => d.value);
    const maxVal = Math.max(...vals);
    return maxVal === 0 ? 10 : maxVal * 1.15; // pad 15% for visual space
  }, [metricTimelineData]);

  // Render Consistency Area Chart path
  const areaPath = useMemo(() => {
    const width = 500;
    const height = 140;
    const padding = 30;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    const points = consistencyData.map((d, i) => {
      const x = padding + i * (plotWidth / 3);
      const y = padding + plotHeight - (d.rate / 100) * plotHeight;
      return { x, y };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    
    return { linePath, fillPath, points };
  }, [consistencyData]);

  // Render Metric Line Chart path
  const metricPath = useMemo(() => {
    if (metricTimelineData.length === 0) return null;
    const width = 500;
    const height = 140;
    const padding = 30;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;

    const points = metricTimelineData.map((d, i) => {
      const x = padding + i * (plotWidth / 13);
      const y = padding + plotHeight - (d.value / metricMax) * plotHeight;
      return { x, y, label: d.dateLabel, val: d.value, completed: d.completed };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    
    return { linePath, fillPath, points };
  }, [metricTimelineData, metricMax]);

  return (
    <div className="flex flex-col gap-6" style={{ width: '100%' }}>
      {/* User Stats Switcher */}
      {usersList.length > 1 && (
        <div className="flex" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
          {usersList.map(u => (
            <button
              key={u.id}
              onClick={() => {
                setSelectedUserId(u.id);
                setSelectedHabitId('all');
              }}
              className={`category-pill ${selectedUserId === u.id ? 'active' : ''}`}
            >
              {u.id === currentUser.id ? 'My Stats' : `${u.name}'s Stats`}
            </button>
          ))}
        </div>
      )}

      {/* Top Profile Summary */}
      <div className="habit-card justify-between items-center" style={{ padding: '1.25rem' }}>
        <div>
          <h2 className="text-lg font-bold text-white">{targetUser.name}'s Performance</h2>
          <p className="text-xs text-zinc-400 mt-1">Consistency metrics over the past month</p>
        </div>
        <div className="flex gap-4">
          <div style={{ textAlign: 'right' }}>
            <span className="text-xs text-zinc-500 uppercase tracking-wider block">Completed</span>
            <span className="text-xl font-bold text-emerald-400">{stats.totalCompletions}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="text-xs text-zinc-500 uppercase tracking-wider block">Consistency</span>
            <span className="text-xl font-bold text-white">{stats.completionRate}%</span>
          </div>
        </div>
      </div>

      {/* Main Consistency Trend (SVG Area Chart) */}
      <div className="habit-card flex-col" style={{ padding: '1.25rem' }}>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" />
          <span>4-Week Consistency Trend</span>
        </h3>
        
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <svg viewBox="0 0 500 140" width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="30" y1="30" x2="470" y2="30" stroke="#242427" strokeDasharray="3,3" />
            <line x1="30" y1="70" x2="470" y2="70" stroke="#242427" strokeDasharray="3,3" />
            <line x1="30" y1="110" x2="470" y2="110" stroke="#242427" />

            {/* Area & Line */}
            <path d={areaPath.fillPath} fill="url(#areaGrad)" />
            <path d={areaPath.linePath} fill="none" stroke="#10b981" strokeWidth="2.5" />

            {/* Points & Labels */}
            {areaPath.points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill="#09090b"
                  stroke="#10b981"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={p.y - 10}
                  fill="#ffffff"
                  fontSize="9px"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {consistencyData[idx].rate}%
                </text>
                <text
                  x={p.x}
                  y="128"
                  fill="#71717a"
                  fontSize="9px"
                  fontWeight="500"
                  textAnchor="middle"
                >
                  {consistencyData[idx].label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Grid of Day-of-week Distribution & Habit Detail Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
        {/* Weekly Activity Distribution Bar Chart */}
        <div className="habit-card flex-col" style={{ padding: '1.25rem' }}>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-emerald-400" />
            <span>Activity by Weekday</span>
          </h3>

          <div style={{ width: '100%', overflow: 'hidden' }}>
            <svg viewBox="0 0 500 130" width="100%" height="100%" style={{ overflow: 'visible' }}>
              {/* Grid Lines */}
              <line x1="30" y1="20" x2="470" y2="20" stroke="#242427" strokeDasharray="3,3" />
              <line x1="30" y1="60" x2="470" y2="60" stroke="#242427" strokeDasharray="3,3" />
              <line x1="30" y1="100" x2="470" y2="100" stroke="#242427" />

              {/* Columns */}
              {distributionData.map((d, idx) => {
                const maxCount = Math.max(...distributionData.map(x => x.count));
                const scaleMax = maxCount === 0 ? 5 : maxCount;
                const colWidth = 24;
                const colX = 30 + idx * (440 / 6) - colWidth / 2;
                
                const colHeight = (d.count / scaleMax) * 80;
                const colY = 100 - colHeight;

                return (
                  <g key={idx}>
                    {/* Bar */}
                    <rect
                      x={colX}
                      y={colY}
                      width={colWidth}
                      height={Math.max(colHeight, 2)}
                      rx="4"
                      fill={d.count > 0 ? 'hsl(var(--accent))' : '#242427'}
                    />
                    {/* Count Text */}
                    {d.count > 0 && (
                      <text
                        x={colX + colWidth / 2}
                        y={colY - 6}
                        fill="#ffffff"
                        fontSize="9px"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {d.count}
                      </text>
                    )}
                    {/* Weekday Label */}
                    <text
                      x={colX + colWidth / 2}
                      y="118"
                      fill="#71717a"
                      fontSize="9px"
                      fontWeight="500"
                      textAnchor="middle"
                    >
                      {d.day}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Custom Habit Details Tracker */}
        <div className="habit-card flex-col" style={{ padding: '1.25rem' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Heart size={16} className="text-emerald-400" />
              <span>Habit Detail Tracker</span>
            </h3>
            
            {/* Habit selector dropdown */}
            <select
              value={selectedHabitId}
              onChange={e => setSelectedHabitId(e.target.value)}
              className="input-text"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto', maxWidth: '160px' }}
            >
              <option value="all">Select Habit...</option>
              {userHabits.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          {selectedHabitId === 'all' || !selectedHabit ? (
            <div className="flex flex-col items-center justify-center text-zinc-500 text-xs py-8 text-center" style={{ gap: '0.25rem' }}>
              <Award size={24} className="text-zinc-600 mb-1" />
              <span>Select a habit above to inspect its metrics</span>
              <span>and view numerical tracking logs.</span>
            </div>
          ) : (
            <div style={{ width: '100%' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-white" style={{ background: '#242427', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                  Category: {selectedHabit.category}
                </span>
                {selectedHabit.unit && (
                  <span className="text-xs font-semibold text-emerald-400" style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    Tracks: {selectedHabit.unit}
                  </span>
                )}
              </div>

              {/* Line graph for habit over the last 14 days */}
              <div style={{ width: '100%', overflow: 'hidden' }} className="mt-3">
                <p className="text-xs text-zinc-500 mb-2">Logged quantities over last 14 days:</p>
                
                {metricPath && (
                  <svg viewBox="0 0 500 140" width="100%" height="100%" style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    <line x1="30" y1="30" x2="470" y2="30" stroke="#242427" strokeDasharray="3,3" />
                    <line x1="30" y1="70" x2="470" y2="70" stroke="#242427" strokeDasharray="3,3" />
                    <line x1="30" y1="110" x2="470" y2="110" stroke="#242427" />

                    {/* Fill & Line */}
                    <path d={metricPath.fillPath} fill="url(#metricGrad)" />
                    <path d={metricPath.linePath} fill="none" stroke="#10b981" strokeWidth="2" />

                    {/* Plot Points */}
                    {metricPath.points.map((p, idx) => (
                      <g key={idx}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={p.completed ? '4' : '2'}
                          fill={p.completed ? 'hsl(var(--accent))' : '#242427'}
                          stroke={p.completed ? '#09090b' : 'none'}
                          strokeWidth="1"
                        />
                        {/* Display values above point if it's completed and tracks unit */}
                        {p.completed && selectedHabit.unit && (
                          <text
                            x={p.x}
                            y={p.y - 8}
                            fill="#ffffff"
                            fontSize="8px"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            {p.val}
                          </text>
                        )}
                        {/* Date x axis label (show every other day to prevent text overlap) */}
                        {idx % 2 === 0 && (
                          <text
                            x={p.x}
                            y="126"
                            fill="#71717a"
                            fontSize="8px"
                            fontWeight="500"
                            textAnchor="middle"
                          >
                            {p.label}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
