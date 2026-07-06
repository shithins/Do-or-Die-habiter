import PocketBase from 'pocketbase';
import { db } from './db';
import type { Habit, Completion, SyncAction } from './db';

// Initialize PocketBase. Default to local instance.
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
export const pb = new PocketBase(PB_URL);

// Re-authenticate from saved session on startup
const savedSession = db.getUser();
if (savedSession) {
  pb.authStore.save(savedSession.token, {
    id: savedSession.id,
    username: savedSession.username,
    name: savedSession.name
  } as any);
}

// Keep db user session in sync with pb authStore
pb.authStore.onChange((token, model) => {
  if (token && model) {
    db.setUser({
      id: model.id,
      username: (model as any).username || '',
      name: (model as any).name || '',
      token
    });
  } else {
    db.setUser(null);
  }
});

// Registry of UI listeners to trigger when data updates (real-time or sync)
type UpdateListener = () => void;
const listeners = new Set<UpdateListener>();

export const syncEngine = {
  subscribe(listener: UpdateListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  notifyListeners(): void {
    listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying UI listener:', err);
      }
    });
  },

  isOnline(): boolean {
    return navigator.onLine && !db.isForceOffline();
  },

  // --- Real-time Subscription ---
  subscribed: false,

  async startRealtimeSubscription(): Promise<void> {
    if (this.subscribed || !this.isOnline() || !pb.authStore.isValid) return;

    try {
      // Subscribe to all changes in habits
      await pb.collection('habits').subscribe('*', (e) => {
        const localHabits = db.getHabits();
        if (e.action === 'create' || e.action === 'update') {
          const habit: Habit = {
            id: e.record.id,
            name: e.record.name,
            category: e.record.category,
            user: e.record.user,
            unit: e.record.unit,
            created: e.record.created,
            updated: e.record.updated
          };
          const index = localHabits.findIndex(h => h.id === habit.id);
          if (index > -1) {
            localHabits[index] = habit;
          } else {
            localHabits.push(habit);
          }
        } else if (e.action === 'delete') {
          const index = localHabits.findIndex(h => h.id === e.record.id);
          if (index > -1) {
            localHabits.splice(index, 1);
          }
        }
        db.saveHabits(localHabits);
        this.notifyListeners();
      });

      // Subscribe to all changes in completions
      await pb.collection('completions').subscribe('*', (e) => {
        const localCompletions = db.getCompletions();
        if (e.action === 'create' || e.action === 'update') {
          const completion: Completion = {
            id: e.record.id,
            habit: e.record.habit,
            date: e.record.date,
            note: e.record.note,
            value: e.record.value,
            created: e.record.created,
            updated: e.record.updated
          };
          const index = localCompletions.findIndex(c => c.id === completion.id || (c.habit === completion.habit && c.date === completion.date));
          if (index > -1) {
            localCompletions[index] = completion;
          } else {
            localCompletions.push(completion);
          }
        } else if (e.action === 'delete') {
          const index = localCompletions.findIndex(c => c.id === e.record.id || (c.habit === e.record.habit && c.date === e.record.date));
          if (index > -1) {
            localCompletions.splice(index, 1);
          }
        }
        db.saveCompletions(localCompletions);
        this.notifyListeners();
      });

      this.subscribed = true;
      console.log('Successfully subscribed to PocketBase real-time updates');
    } catch (err) {
      console.error('Error establishing PocketBase subscription:', err);
    }
  },

  stopRealtimeSubscription(): void {
    if (!this.subscribed) return;
    try {
      pb.collection('habits').unsubscribe('*');
      pb.collection('completions').unsubscribe('*');
      this.subscribed = false;
      console.log('Unsubscribed from PocketBase real-time updates');
    } catch (err) {
      console.error('Error unsubscribing:', err);
    }
  },

  // --- Push Sync (Process Queue) ---
  syncingInProgress: false,

  async sync(): Promise<boolean> {
    if (this.syncingInProgress) return false;
    if (!this.isOnline()) {
      this.stopRealtimeSubscription();
      return false;
    }

    this.syncingInProgress = true;
    let success = true;

    try {
      // 1. Authenticate if token is valid but client isn't fully set up (should be fine via authStore)
      if (!pb.authStore.isValid) {
        this.syncingInProgress = false;
        return false;
      }

      // 2. Process Queue
      const queue = db.getQueue();
      for (const action of queue) {
        try {
          await this.processQueueAction(action);
          db.removeFromQueue(action.id);
        } catch (err) {
          console.error(`Failed to sync action ${action.type}:`, err);
          // Stop queue processing on network/auth error to preserve order, but let local conflicts slide
          if (err instanceof Error && (err.message.includes('network') || err.message.includes('status 0') || err.message.includes('Unauthorized'))) {
            success = false;
            break;
          }
        }
      }

      // 3. Fetch latest data from server to cache locally
      if (success) {
        await this.pullLatestData();
        await this.startRealtimeSubscription(); // Ensure active subscription when online
      }
    } catch (err) {
      console.error('Sync failed:', err);
      success = false;
    } finally {
      this.syncingInProgress = false;
      this.notifyListeners();
    }

    return success;
  },

  async processQueueAction(action: SyncAction): Promise<void> {
    switch (action.type) {
      case 'create_habit': {
        const { name, category, user, id, unit } = action.payload;
        try {
          // Attempt to create on server.
          await pb.collection('habits').create({
            id: id.startsWith('local_') ? undefined : id, // If it has a clean ID, use it. Otherwise let PB generate.
            name,
            category,
            user,
            unit
          });
        } catch (err: any) {
          // If already exists on server, ignore conflict and proceed
          if (err.status !== 400 && err.status !== 409) throw err;
        }
        break;
      }

      case 'delete_habit': {
        const { id } = action.payload;
        try {
          await pb.collection('habits').delete(id);
        } catch (err: any) {
          // If record does not exist on server (404), it's already deleted. Ignore.
          if (err.status !== 404) throw err;
        }
        break;
      }

      case 'toggle_completion': {
        const { habitId, date, note, value, completed } = action.payload;
        if (completed) {
          try {
            // Check if already checked off on remote to avoid unique constraint errors
            const records = await pb.collection('completions').getList(1, 1, {
              filter: `habit = "${habitId}" && date = "${date}"`
            });
            if (records.items.length === 0) {
              await pb.collection('completions').create({
                habit: habitId,
                date,
                note: note || '',
                value: value
              });
            } else {
              // Update note/value if they changed
              const existing = records.items[0];
              if (existing.note !== note || existing.value !== value) {
                await pb.collection('completions').update(existing.id, {
                  note: note || '',
                  value: value
                });
              }
            }
          } catch (err: any) {
            if (err.status !== 400 && err.status !== 409) throw err;
          }
        } else {
          // Delete completion record
          try {
            const records = await pb.collection('completions').getList(1, 5, {
              filter: `habit = "${habitId}" && date = "${date}"`
            });
            for (const item of records.items) {
              await pb.collection('completions').delete(item.id);
            }
          } catch (err: any) {
            if (err.status !== 404) throw err;
          }
        }
        break;
      }
    }
  },

  async pullLatestData(): Promise<void> {
    if (!pb.authStore.isValid) return;

    try {
      // Fetch and cache all users
      const usersList = await pb.collection('users').getFullList<any>();
      localStorage.setItem('habit_grid_users', JSON.stringify(usersList.map(u => ({ id: u.id, username: u.username, name: u.name }))));
    } catch (e) {
      console.error('Failed to pull users list:', e);
    }

    // Fetch all habits
    const habitsList = await pb.collection('habits').getFullList<any>({
      sort: '-created'
    });
    const habits: Habit[] = habitsList.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      user: r.user,
      unit: r.unit,
      created: r.created,
      updated: r.updated
    }));
    db.saveHabits(habits);

    // Fetch all completions (or filter by last 6 months to prevent bloated storage)
    const completionsList = await pb.collection('completions').getFullList<any>({
      sort: '-date'
    });
    const completions: Completion[] = completionsList.map(r => ({
      id: r.id,
      habit: r.habit,
      date: r.date,
      note: r.note,
      value: r.value,
      created: r.created,
      updated: r.updated
    }));
    db.saveCompletions(completions);
  }
};

// Listen to browser network changes to automatically trigger sync
window.addEventListener('online', () => {
  console.log('App is online. Triggering sync...');
  syncEngine.sync();
});

window.addEventListener('offline', () => {
  console.log('App is offline.');
  syncEngine.stopRealtimeSubscription();
  syncEngine.notifyListeners();
});
