import { AlertCircle } from 'lucide-react';
import { ValidationError } from '../utils/validation';

interface ValidationErrorProps {
  errors: ValidationError[];
}

export function ValidationErrorDisplay({ errors }: ValidationErrorProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-bold text-red-900 mb-2">Ошибки в форме:</h3>
          <ul className="space-y-1">
            {errors.map((error, i) => (
              <li key={i} className="text-sm text-red-800">
                • {error.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
