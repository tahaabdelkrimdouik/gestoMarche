
import { Plus } from 'lucide-react';

interface FloatingActionButtonProps {
  label: string;
  onClick: () => void;
}

export default function FloatingActionButton({ label, onClick }: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-40 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg shadow-emerald-200 flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation"
      aria-label={label}
    >
      <Plus className="w-6 h-6" />
    </button>
  );
}