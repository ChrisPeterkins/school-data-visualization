import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, onSearch, placeholder }: SearchBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Search..."}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-colors"
        />
      </div>
      <button
        type="submit"
        className="px-5 py-2.5 bg-navy-700 text-white text-sm font-medium rounded-lg hover:bg-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-500/30 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
