interface StockFiltersProps {
  activeFilter: string;                    // L'ID du filtre actif (ex: 'all')
  onFilterChange: (filter: 'all' | 'low' | 'out') => void;   // Une fonction qui change le filtre
}

const filters = [
  { id: 'all', label: 'Tous' },
  { id: 'low', label: 'À racheter' },
  { id: 'out', label: 'En rupture' },
];

export default function StockFilters({ activeFilter, onFilterChange }: StockFiltersProps) {
  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-3 gap-2">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.id;
          
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id as 'all' | 'low' | 'out')}
              className={`relative px-3 py-3 min-h-[52px] rounded-2xl text-xs sm:text-sm font-medium transition-all duration-300 touch-manipulation active:scale-95 ${
                isActive 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="block leading-tight">
                {filter.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}