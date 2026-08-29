/**
 * IncidentSearch component.
 * 
 * Provides search input for incidents with debouncing.
 * Integrates with filter state management.
 */

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../components/ui/Input';

interface IncidentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function IncidentSearch({ 
  value, 
  onChange, 
  placeholder = 'Search incidents...',
  className = '' 
}: IncidentSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync with prop value using derived state approach
  if (value !== localValue) {
    setLocalValue(value);
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-10 pr-10"
        aria-label="Search incidents"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
