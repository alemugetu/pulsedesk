/**
 * AuthFormField component - Reusable form field for authentication forms.
 * 
 * Provides input fields with labels, error messages, and password visibility toggle.
 * Follows accessibility best practices.
 */

import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, ShieldCheck } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { cn } from '../../../utils/cn';

interface AuthFormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function AuthFormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  required = false,
  autoComplete,
  disabled = false,
  autoFocus = false,
}: AuthFormFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const isEmail = type === 'email';
  const inputType = isPassword && showPassword ? 'text' : type;

  // Get appropriate icon based on field type
  const getFieldIcon = () => {
    if (isPassword) return <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    if (isEmail) return <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    if (name.includes('name')) return <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    if (name.includes('token') || name.includes('code')) return <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    return <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  };

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          {getFieldIcon()}
        </div>
        <Input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={onChange}
          error={error}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            'pl-10',
            isPassword && 'pr-10'
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p
          id={`${name}-error`}
          className="text-sm text-red-500"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
