
interface CustomButtonProps {
  label: string;      // On définit le type
  onClick: () => void; // On définit que c'est une fonction qui ne retourne rien
}

// 2. Appliquer l'interface
export default function CustomButton({ label, onClick }: CustomButtonProps) {
  return (
    <button 
      onClick={onClick} 
      className="px-4 py-2 bg-emerald-500 text-white rounded-lg"
    >
      {/* 3. On utilise 'label' ici pour supprimer l'erreur "never read" */}
      {label}
    </button>
  );
}