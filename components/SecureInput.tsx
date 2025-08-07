// Безопасный компонент для ввода с санитизацией и валидацией
import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { sanitizers, validators } from '../config/security';

export interface SecureInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'url' | 'tel' | 'number' | 'password';
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  spellCheck?: boolean;
  className?: string;
  style?: React.CSSProperties;
  validation?: {
    pattern?: RegExp;
    customValidator?: (value: string) => { valid: boolean; error?: string };
    sanitize?: boolean;
    allowHtml?: boolean;
  };
  error?: string;
  onError?: (error: string) => void;
  onValid?: (value: string) => void;
}

export interface SecureInputRef {
  focus: () => void;
  blur: () => void;
  select: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  validate: () => { valid: boolean; error?: string };
}

const SecureInput = forwardRef<SecureInputRef, SecureInputProps>((props, ref) => {
  const {
    value,
    onChange,
    onBlur,
    placeholder,
    type = 'text',
    maxLength = 1000,
    minLength = 0,
    required = false,
    disabled = false,
    readOnly = false,
    autoFocus = false,
    autoComplete,
    spellCheck = true,
    className = '',
    style,
    validation = {},
    error: externalError,
    onError,
    onValid
  } = props;

  const [internalValue, setInternalValue] = useState(value);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Обновляем внутреннее значение при изменении внешнего
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Валидация значения
  const validateValue = (inputValue: string): { valid: boolean; error?: string } => {
    // Проверка на пустое значение
    if (required && (!inputValue || inputValue.trim().length === 0)) {
      return { valid: false, error: 'Это поле обязательно для заполнения' };
    }

    // Проверка минимальной длины
    if (inputValue.length < minLength) {
      return { valid: false, error: `Минимальная длина: ${minLength} символов` };
    }

    // Проверка максимальной длины
    if (inputValue.length > maxLength) {
      return { valid: false, error: `Максимальная длина: ${maxLength} символов` };
    }

    // Валидация по типу
    switch (type) {
      case 'email':
        const emailValidation = validators.validateEmail(inputValue);
        if (!emailValidation.valid) {
          return { valid: false, error: emailValidation.error || 'Неверный формат email' };
        }
        break;

      case 'url':
        const urlValidation = validators.validateUrl(inputValue);
        if (!urlValidation.valid) {
          return { valid: false, error: urlValidation.error || 'Неверный формат URL' };
        }
        break;

      case 'tel':
        if (inputValue && !/^[\d+\-()\s]+$/.test(inputValue)) {
          return { valid: false, error: 'Неверный формат номера телефона' };
        }
        break;

      case 'number':
        if (inputValue && isNaN(Number(inputValue))) {
          return { valid: false, error: 'Значение должно быть числом' };
        }
        break;
    }

    // Кастомная валидация
    if (validation.customValidator) {
      const customResult = validation.customValidator(inputValue);
      if (!customResult.valid) {
        return { valid: false, error: customResult.error || 'Неверное значение' };
      }
    }

    // Валидация по паттерну
    if (validation.pattern && !validation.pattern.test(inputValue)) {
      return { valid: false, error: 'Значение не соответствует требуемому формату' };
    }

    return { valid: true };
  };

  // Санитизация значения
  const sanitizeValue = (inputValue: string): string => {
    if (!inputValue) return inputValue;

    let sanitized = inputValue;

    // Санитизация в зависимости от типа
    switch (type) {
      case 'email':
        sanitized = sanitizers.sanitizeEmail(inputValue);
        break;

      case 'url':
        sanitized = sanitizers.sanitizeUrl(inputValue);
        break;

      case 'tel':
        sanitized = sanitizers.sanitizePhone(inputValue);
        break;

      default:
        if (validation.sanitize !== false) {
          sanitized = validation.allowHtml ? inputValue : sanitizers.sanitizeHtml(inputValue);
        }
        break;
    }

    // Ограничиваем длину
    if (sanitized.length > maxLength) {
      sanitized = sanitized.slice(0, maxLength);
    }

    return sanitized;
  };

  // Обработка изменения значения
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    const sanitizedValue = sanitizeValue(rawValue);
    
    setInternalValue(sanitizedValue);
    setIsDirty(true);

    // Валидация
    const validationResult = validateValue(sanitizedValue);
    
    if (validationResult.valid) {
      setInternalError(null);
      onValid?.(sanitizedValue);
    } else {
      setInternalError(validationResult.error || 'Неверное значение');
      onError?.(validationResult.error || 'Неверное значение');
    }

    // Вызываем внешний обработчик
    onChange(sanitizedValue);
  };

  // Обработка потери фокуса
  const handleBlur = () => {
    setIsFocused(false);
    
    // Финальная валидация при потере фокуса
    const validationResult = validateValue(internalValue);
    
    if (!validationResult.valid) {
      setInternalError(validationResult.error || 'Неверное значение');
      onError?.(validationResult.error || 'Неверное значение');
    } else {
      setInternalError(null);
      onValid?.(internalValue);
    }

    onBlur?.(internalValue);
  };

  // Обработка получения фокуса
  const handleFocus = () => {
    setIsFocused(true);
  };

  // Обработка нажатия клавиш
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Блокируем ввод потенциально опасных символов
    if (type === 'text' && !validation.allowHtml) {
      const dangerousKeys = ['<', '>', '&', '"', "'"];
      if (dangerousKeys.includes(event.key)) {
        event.preventDefault();
        return;
      }
    }
  };

  // Экспортируем методы через ref
  React.useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    select: () => inputRef.current?.select(),
    getValue: () => internalValue,
    setValue: (newValue: string) => {
      const sanitized = sanitizeValue(newValue);
      setInternalValue(sanitized);
      onChange(sanitized);
    },
    validate: () => validateValue(internalValue)
  }));

  // Определяем классы для стилизации
  const inputClasses = [
    'w-full px-3 py-2 border rounded-lg transition-colors duration-200',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    'disabled:bg-gray-100 disabled:cursor-not-allowed',
    'readonly:bg-gray-50',
    className
  ];

  if (internalError || externalError) {
    inputClasses.push('border-red-500 focus:ring-red-500');
  } else if (isFocused) {
    inputClasses.push('border-blue-500');
  } else {
    inputClasses.push('border-gray-300');
  }

  const errorMessage = externalError || internalError;

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type={type}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        minLength={minLength}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
        className={inputClasses.join(' ')}
        style={style}
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? 'input-error' : undefined}
      />
      
      {errorMessage && (
        <div
          id="input-error"
          className="mt-1 text-sm text-red-600"
          role="alert"
          aria-live="polite"
        >
          {errorMessage}
        </div>
      )}
      
      {isDirty && !errorMessage && (
        <div className="mt-1 text-sm text-green-600">
          ✓ Валидно
        </div>
      )}
    </div>
  );
});

SecureInput.displayName = 'SecureInput';

export default SecureInput;
