// Local Database & Sync Queue Utility using localStorage for offline-first operations

export interface Habit {
  id: string;
  name: string;
  category: string;
  user: string;
  unit?: string; // e.g. "hrs", "pages"
  created?: string;
  updated?: string;
}

export interface Completion {
  id: string;
  habit: string; // Habit ID
  date: string;  // YYYY-MM-DD
  note?: string;
  value?: number; // e.g. 8, 20
  created?: string;
  updated?: string;
}

export interface SyncAction {
  id: string;
  type: 'create_habit' | 'delete_habit' | 'toggle_completion';
  timestamp: number;
  payload: any;
}

export interface UserSession {
  id: string;
  username: string;
  name: string;
  token: string;
}

const KEYS = {
  HABITS: 'habit_grid_habits',
  COMPLETIONS: 'habit_grid_completions',
  QUEUE: 'habit_grid_sync_queue',
  USER: 'habit_grid_user_session',
  OFFLINE_MODE: 'habit_grid_offline_mode'
};

export const db = {
  // --- User Session ---
  getUser(): UserSession | null {
    const data = localStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  setUser(user: UserSession | null): void {
    if (user) {
      localStorage.setItem(KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.USER);
    }
  },

  // --- Habits ---
  getHabits(): Habit[] {
    const data = localStorage.getItem(KEYS.HABITS);
    return data ? JSON.parse(data) : [];
  },

  saveHabits(habits: Habit[]): void {
    localStorage.setItem(KEYS.HABITS, JSON.stringify(habits));
  },

  addLocalHabit(habit: Habit): void {
    const habits = this.getHabits();
    // Prevent duplicate
    if (!habits.some(h => h.id === habit.id)) {
      habits.push(habit);
      this.saveHabits(habits);
    }
  },

  deleteLocalHabit(id: string): void {
    const habits = this.getHabits().filter(h => h.id !== id);
    this.saveHabits(habits);

    // Also cascade delete local completions
    const completions = this.getCompletions().filter(c => c.habit !== id);
    this.saveCompletions(completions);
  },

  // --- Completions ---
  getCompletions(): Completion[] {
    const data = localStorage.getItem(KEYS.COMPLETIONS);
    return data ? JSON.parse(data) : [];
  },

  saveCompletions(completions: Completion[]): void {
    localStorage.setItem(KEYS.COMPLETIONS, JSON.stringify(completions));
  },

  toggleLocalCompletion(habitId: string, date: string, note?: string, value?: number): { completed: boolean; completion: Completion | null } {
    const completions = this.getCompletions();
    const existingIndex = completions.findIndex(c => c.habit === habitId && c.date === date);

    if (existingIndex > -1) {
      // Uncheck (remove completion)
      completions.splice(existingIndex, 1);
      this.saveCompletions(completions);
      return { completed: false, completion: null };
    } else {
      // Check (add completion)
      const newCompletion: Completion = {
        id: `local_${Math.random().toString(36).substr(2, 9)}`, // temporary local ID
        habit: habitId,
        date,
        note: note || '',
        value: value,
        created: new Date().toISOString()
      };
      completions.push(newCompletion);
      this.saveCompletions(completions);
      return { completed: true, completion: newCompletion };
    }
  },

  // --- Sync Queue ---
  getQueue(): SyncAction[] {
    const data = localStorage.getItem(KEYS.QUEUE);
    return data ? JSON.parse(data) : [];
  },

  saveQueue(queue: SyncAction[]): void {
    localStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
  },

  addToQueue(type: SyncAction['type'], payload: any): void {
    const queue = this.getQueue();
    const action: SyncAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      timestamp: Date.now(),
      payload
    };

    // Optimisation: if we toggle completion for the same habit and date multiple times in the queue,
    // we can collapse them or just process them in order. For simplicity, append to the end.
    queue.push(action);
    this.saveQueue(queue);
  },

  removeFromQueue(actionId: string): void {
    const queue = this.getQueue().filter(act => act.id !== actionId);
    this.saveQueue(queue);
  },

  // --- Force Offline Test Flag ---
  isForceOffline(): boolean {
    return localStorage.getItem(KEYS.OFFLINE_MODE) === 'true';
  },

  setForceOffline(offline: boolean): void {
    localStorage.setItem(KEYS.OFFLINE_MODE, String(offline));
  }
};
