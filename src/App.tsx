import { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LogOut, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Layers,
  User
} from 'lucide-react';
import { pb, syncEngine } from './utils/sync';
import { db } from './utils/db';
import type { Habit, Completion } from './utils/db';
import { StreakGrid } from './components/StreakGrid';
import { NoteModal } from './components/NoteModal';
import { ToastNotification } from './components/ToastNotification';
import { ChartsDashboard } from './components/ChartsDashboard';

// Timezone-safe date helper
const getLocalDateString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Get Monday of the week containing date d
const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(date.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
};

// Date range label formatter (e.g. "Jul 6 - Jul 12")
const getWeekRangeLabel = (start: Date): string => {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  
  const endOptions: Intl.DateTimeFormatOptions = start.getMonth() === end.getMonth() 
    ? { day: 'numeric' } 
    : { month: 'short', day: 'numeric' };
  const endStr = end.toLocaleDateString('en-US', endOptions);
  
  return `${startStr} – ${endStr}`;
};

function App() {
  // Auth state
  const [user, setUser] = useState(db.getUser());
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App data state
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; username: string; name: string }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Layout / Filter state
  const [activeBoard, setActiveBoard] = useState<'me' | 'vaisakh' | 'charts'>('me');
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  // Custom habit creation form state
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitCategory, setNewHabitCategory] = useState('');
  const [newHabitUnit, setNewHabitUnit] = useState('');

  // Sync state
  const [isOnline, setIsOnline] = useState(syncEngine.isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isForceOffline, setIsForceOffline] = useState(db.isForceOffline());

  // Note modal state
  const [noteModal, setNoteModal] = useState<{
    isOpen: boolean;
    habitId: string;
    habitName: string;
    date: string;
  }>({
    isOpen: false,
    habitId: '',
    habitName: '',
    date: ''
  });

  // Streak Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    habitName: string;
    streakCount: number;
  }>({
    show: false,
    habitName: '',
    streakCount: 0
  });

  // --- Auth Handlers ---
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!usernameInput || !passwordInput) return;

    setAuthError('');
    setIsLoggingIn(true);

    try {
      if (syncEngine.isOnline()) {
        const authData = await pb.collection('users').authWithPassword(usernameInput, passwordInput);
        if (authData) {
          const session = {
            id: authData.record.id,
            username: authData.record.username,
            name: authData.record.name || authData.record.username,
            token: authData.token
          };
          db.setUser(session);
          setUser(session);
          syncEngine.sync();
        }
      } else {
        // Offline Auth Fallback: check against seeded developers usernames
        const lowerUser = usernameInput.toLowerCase();
        if ((lowerUser === 'shithin' && passwordInput === 'shithin1234') || 
            (lowerUser === 'vaisakh' && passwordInput === 'vaisakh1234')) {
          const simulatedSession = {
            id: lowerUser === 'shithin' ? 'shithinuser1234' : 'vaisakhuser1234',
            username: lowerUser,
            name: lowerUser === 'shithin' ? 'Shithin' : 'Vaisakh',
            token: 'simulated_offline_token'
          };
          db.setUser(simulatedSession);
          setUser(simulatedSession);
          setRefreshKey(prev => prev + 1);
        } else {
          setAuthError('Offline login requires developer credentials (shithin / vaisakh).');
        }
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDeveloperLogin = (devUser: 'shithin' | 'vaisakh') => {
    setUsernameInput(devUser);
    setPasswordInput(devUser === 'shithin' ? 'shithin1234' : 'vaisakh1234');
    setTimeout(() => {
      setIsLoggingIn(true);
      const username = devUser;
      const password = devUser === 'shithin' ? 'shithin1234' : 'vaisakh1234';
      if (syncEngine.isOnline()) {
        pb.collection('users').authWithPassword(username, password)
          .then(authData => {
            const session = {
              id: authData.record.id,
              username: authData.record.username,
              name: authData.record.name || authData.record.username,
              token: authData.token
            };
            db.setUser(session);
            setUser(session);
            syncEngine.sync();
          })
          .catch(() => {
            const simulatedSession = {
              id: devUser === 'shithin' ? 'shithinuser1234' : 'vaisakhuser1234',
              username: devUser,
              name: devUser === 'shithin' ? 'Shithin' : 'Vaisakh',
              token: 'simulated_offline_token'
            };
            db.setUser(simulatedSession);
            setUser(simulatedSession);
            setRefreshKey(prev => prev + 1);
          })
          .finally(() => setIsLoggingIn(false));
      } else {
        const simulatedSession = {
          id: devUser === 'shithin' ? 'shithinuser1234' : 'vaisakhuser1234',
          username: devUser,
          name: devUser === 'shithin' ? 'Shithin' : 'Vaisakh',
          token: 'simulated_offline_token'
        };
        db.setUser(simulatedSession);
        setUser(simulatedSession);
        setIsLoggingIn(false);
        setRefreshKey(prev => prev + 1);
      }
    }, 100);
  };

  const handleLogout = () => {
    pb.authStore.clear();
    db.setUser(null);
    setUser(null);
    syncEngine.stopRealtimeSubscription();
  };

  // --- Synchronization & Connection Control ---
  const toggleForceOffline = () => {
    const nextVal = !isForceOffline;
    db.setForceOffline(nextVal);
    setIsForceOffline(nextVal);
    setIsOnline(navigator.onLine && !nextVal);
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const handleConnectionChange = () => {
      setIsOnline(navigator.onLine && !db.isForceOffline());
    };
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, []);

  // Fetch local data
  useEffect(() => {
    if (!user) return;
    setHabits(db.getHabits());
    setCompletions(db.getCompletions());
    
    const cachedUsers = localStorage.getItem('habit_grid_users');
    if (cachedUsers) {
      setUsersList(JSON.parse(cachedUsers));
    }
  }, [user, refreshKey]);

  // Sync loop
  useEffect(() => {
    if (!user) return;

    setIsSyncing(true);
    syncEngine.sync().finally(() => setIsSyncing(false));

    const unsubscribe = syncEngine.subscribe(() => {
      setRefreshKey(prev => prev + 1);
      setIsOnline(syncEngine.isOnline());
    });

    const syncInterval = setInterval(() => {
      if (syncEngine.isOnline()) {
        syncEngine.sync();
      }
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
      syncEngine.stopRealtimeSubscription();
    };
  }, [user]);

  // --- Streak Milestone Checking ---
  const checkStreakMilestone = (habitId: string, habitName: string) => {
    const currentCompletions = db.getCompletions();
    const dates = currentCompletions
      .filter(c => c.habit === habitId)
      .map(c => c.date)
      .filter((v, i, self) => self.indexOf(v) === i)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (dates.length === 0) return;

    const todayStr = getLocalDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let streak = 0;
    const hasCompletedToday = dates.includes(todayStr);
    const hasCompletedYesterday = dates.includes(yesterdayStr);

    let expectedDate = new Date();

    if (hasCompletedToday) {
      streak = 1;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else if (hasCompletedYesterday) {
      streak = 1;
      expectedDate = yesterday;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      return;
    }

    while (true) {
      const checkStr = getLocalDateString(expectedDate);
      if (dates.includes(checkStr)) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        break;
      }
    }

    if (streak === 7 || streak === 14 || streak === 30) {
      setToast({
        show: true,
        habitName,
        streakCount: streak
      });
    }
  };

  const handleCellClick = (habitId: string, habitName: string, date: string, isCompleted: boolean) => {
    if (isReadOnly) return;

    if (isCompleted) {
      db.toggleLocalCompletion(habitId, date);
      db.addToQueue('toggle_completion', {
        habitId,
        date,
        completed: false
      });
      setRefreshKey(prev => prev + 1);
      syncEngine.sync();
    } else {
      setNoteModal({
        isOpen: true,
        habitId,
        habitName,
        date
      });
    }
  };

  const handleConfirmCompletion = (note: string, value?: number) => {
    const { habitId, habitName, date } = noteModal;
    
    db.toggleLocalCompletion(habitId, date, note, value);
    db.addToQueue('toggle_completion', {
      habitId,
      date,
      note,
      value,
      completed: true
    });

    setNoteModal({ isOpen: false, habitId: '', habitName: '', date: '' });
    setRefreshKey(prev => prev + 1);

    setTimeout(() => {
      checkStreakMilestone(habitId, habitName);
    }, 200);

    syncEngine.sync();
  };

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim() || !newHabitCategory.trim() || !user) return;

    const habitId = `local_${Math.random().toString(36).substr(2, 9)}`;
    const newHabit: Habit = {
      id: habitId,
      name: newHabitName.trim(),
      category: newHabitCategory.trim(),
      user: user.id,
      unit: newHabitUnit.trim() ? newHabitUnit.trim() : undefined
    };

    db.addLocalHabit(newHabit);
    db.addToQueue('create_habit', newHabit);

    setNewHabitName('');
    setNewHabitCategory('');
    setNewHabitUnit('');
    setRefreshKey(prev => prev + 1);
    
    syncEngine.sync();
  };

  const handleDeleteHabit = (habitId: string) => {
    if (!window.confirm('Delete this habit and all its logged completions?')) return;
    
    db.deleteLocalHabit(habitId);
    db.addToQueue('delete_habit', { id: habitId });
    setRefreshKey(prev => prev + 1);

    syncEngine.sync();
  };

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(getLocalDateString(d));
  }

  const shiftWeek = (offset: number) => {
    const nextStart = new Date(weekStart);
    nextStart.setDate(weekStart.getDate() + offset * 7);
    setWeekStart(nextStart);
  };

  const snapToToday = () => {
    setWeekStart(getMonday(new Date()));
  };

  // Find Vaisakh's ID to filter board
  const vaisakhId = usersList.find(u => u.username === 'vaisakh')?.id || 'vaisakhuser1234';
  const shithinId = usersList.find(u => u.username === 'shithin')?.id || 'shithinuser1234';

  const isReadOnly = activeBoard === 'vaisakh';

  const targetUser = activeBoard === 'me' ? user?.id : (user?.username === 'shithin' ? vaisakhId : shithinId);
  const boardHabits = habits.filter(h => h.user === targetUser);

  const categoriesList = ['All', ...Array.from(new Set(boardHabits.map(h => h.category)))];

  const filteredHabits = boardHabits.filter(h => 
    selectedCategory === 'All' || h.category === selectedCategory
  );

  const activeHabitForModal = habits.find(h => h.id === noteModal.habitId);

  // --- Login View ---
  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card glass">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="logo-box" style={{ display: 'inline-flex', marginBottom: '0.75rem', height: '3rem', width: '3rem', fontSize: '1.25rem' }}>
              HG
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Do or Die Habiter</h2>
            <p className="text-xs text-zinc-400 mt-3">Collaborative offline-first contribution tracker</p>
          </div>

          {authError && (
            <div className="error-banner">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-field-group">
              <label className="input-label">Username / Email</label>
              <input
                type="text"
                value={usernameInput}
                onChange={e => setUsernameInput(e.target.value)}
                className="input-text"
                placeholder="shithin or vaisakh"
                disabled={isLoggingIn}
              />
            </div>
            <div className="form-field-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                className="input-text"
                placeholder="••••••••"
                disabled={isLoggingIn}
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="btn-submit-auth"
            >
              {isLoggingIn ? 'Logging in...' : 'Sign In'}
            </button>
          </form>

          <div className="dev-divider">
            <div className="dev-divider-line"></div>
            <span className="dev-divider-text">Developer Access</span>
            <div className="dev-divider-line"></div>
          </div>

          <div className="dev-btn-group">
            <button
              onClick={() => handleDeveloperLogin('shithin')}
              disabled={isLoggingIn}
              className="btn-dev-login"
            >
              Shithin
            </button>
            <button
              onClick={() => handleDeveloperLogin('vaisakh')}
              disabled={isLoggingIn}
              className="btn-dev-login"
            >
              Vaisakh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Board View ---
  return (
    <div className="app-container">
      {/* Toast Notification */}
      <ToastNotification
        show={toast.show}
        habitName={toast.habitName}
        streakCount={toast.streakCount}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />

      {/* Connection and Profile Header */}
      <header className="header-bar">
        <div className="logo-section">
          <div className="logo-box">
            HG
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">Do or Die Habiter</h1>
            <div className="flex items-center">
              {isSyncing ? (
                <div className="status-badge text-zinc-400">
                  <RefreshCw size={10} style={{ animation: 'spin 1.5s linear infinite', marginRight: '0.25rem' }} />
                  <span>Syncing</span>
                </div>
              ) : isOnline ? (
                <div className="status-badge text-emerald-400">
                  <Wifi size={10} style={{ marginRight: '0.25rem' }} />
                  <span>Online</span>
                </div>
              ) : (
                <div className="status-badge text-amber-500">
                  <WifiOff size={10} style={{ marginRight: '0.25rem' }} />
                  <span>Offline cache</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="controls-section">
          <button
            onClick={toggleForceOffline}
            className={`btn-offline-mode ${isForceOffline ? 'active' : ''}`}
            title="Simulate offline state"
          >
            {isForceOffline ? 'Offline Mode' : 'Go Offline'}
          </button>

          <div className="user-badge">
            <User size={13} className="text-zinc-500" />
            <span className="user-name-label truncate">
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="btn-logout"
              title="Logout"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Board Selector Tab Navigation */}
      <div className="tabs-header">
        <button
          onClick={() => {
            setActiveBoard('me');
            setSelectedCategory('All');
          }}
          className={`tab-btn ${activeBoard === 'me' ? 'active' : ''}`}
        >
          My Board
        </button>
        <button
          onClick={() => {
            setActiveBoard('vaisakh');
            setSelectedCategory('All');
          }}
          className={`tab-btn ${activeBoard === 'vaisakh' ? 'active' : ''}`}
        >
          {user.username === 'shithin' ? "Vaisakh's Board" : "Shithin's Board"}
        </button>
        <button
          onClick={() => {
            setActiveBoard('charts');
          }}
          className={`tab-btn ${activeBoard === 'charts' ? 'active' : ''}`}
        >
          Stats & Charts
        </button>
      </div>

      {activeBoard === 'charts' ? (
        <ChartsDashboard
          habits={habits}
          completions={completions}
          currentUser={user}
          usersList={usersList.length > 0 ? usersList : [
            { id: 'shithinuser1234', username: 'shithin', name: 'Shithin' },
            { id: 'vaisakhuser1234', username: 'vaisakh', name: 'Vaisakh' }
          ]}
        />
      ) : (
        <>
          {/* Date Navigation */}
          <div className="date-nav-bar">
            <div className="week-pager">
              <button
                onClick={() => shiftWeek(-1)}
                className="btn-nav-arrow"
                title="Previous Week"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="week-label">
                {getWeekRangeLabel(weekStart)}
              </span>
              <button
                onClick={() => shiftWeek(1)}
                className="btn-nav-arrow"
                title="Next Week"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              onClick={snapToToday}
              className="btn-today"
            >
              <Calendar size={13} />
              <span>This Week</span>
            </button>
          </div>

          {/* Readonly Alert Banner */}
          {isReadOnly && (
            <div className="alert-banner">
              <span className="dot-blue" />
              <p className="text-xs text-zinc-400">
                Viewing <span className="font-semibold text-white">{user.username === 'shithin' ? "Vaisakh's" : "Shithin's"}</span> board. Checks are read-only.
              </p>
            </div>
          )}

          {/* Category Horizontal Filter Pills */}
          {categoriesList.length > 2 && (
            <div className="category-scroller">
              <Layers size={13} className="text-zinc-500 mr-2 shrink-0" />
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Heatmap Grid Row */}
          <StreakGrid
            habits={filteredHabits}
            completions={completions}
            weekDates={weekDates}
            isReadOnly={isReadOnly}
            onCellClick={handleCellClick}
            onDeleteHabit={handleDeleteHabit}
          />

          {/* Create Habit Footer Section */}
          {!isReadOnly && (
            <form onSubmit={handleCreateHabit} className="habit-form-container">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                <Plus size={14} style={{ marginRight: '0.25rem' }} />
                <span>Create Custom Habit</span>
              </h3>

              <div className="form-inputs-row" style={{ flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newHabitName}
                  onChange={e => setNewHabitName(e.target.value)}
                  placeholder="Habit name (e.g. Reading, Sleep)"
                  className="input-text"
                  maxLength={40}
                  required
                />
                <input
                  type="text"
                  value={newHabitCategory}
                  onChange={e => setNewHabitCategory(e.target.value)}
                  placeholder="Category (e.g. Work, Health)"
                  className="input-text"
                  style={{ maxWidth: '140px' }}
                  maxLength={20}
                  required
                />
                <input
                  type="text"
                  value={newHabitUnit}
                  onChange={e => setNewHabitUnit(e.target.value)}
                  placeholder="Unit (e.g. hrs, pages) - optional"
                  className="input-text"
                  style={{ maxWidth: '170px' }}
                  maxLength={15}
                />
                <button
                  type="submit"
                  className="btn-add-habit"
                >
                  Add
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Note modal */}
      <NoteModal
        isOpen={noteModal.isOpen}
        habitName={noteModal.habitName}
        habitUnit={activeHabitForModal?.unit}
        date={noteModal.date}
        onClose={() => setNoteModal({ isOpen: false, habitId: '', habitName: '', date: '' })}
        onConfirm={handleConfirmCompletion}
      />
    </div>
  );
}

export default App;
