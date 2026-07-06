import React, { useEffect } from 'react';
import { Award, X } from 'lucide-react';

interface ToastProps {
  show: boolean;
  habitName: string;
  streakCount: number;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastProps> = ({ show, habitName, streakCount, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="toast-box glass shadow-lg">
      <div className="toast-icon-wrapper">
        <Award size={20} />
      </div>
      <div className="toast-body">
        <p className="text-sm font-semibold text-white">Streak Milestone!</p>
        <p className="text-xs text-zinc-400 truncate">
          <span className="font-semibold text-emerald-400">{habitName}</span> hit a <span className="font-semibold text-white">{streakCount}-day</span> streak.
        </p>
      </div>
      <button onClick={onClose} className="btn-close-toast" aria-label="Close notification">
        <X size={16} />
      </button>
    </div>
  );
};
