import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import Input from '../../../../components/ui/Input';
import { commitPositiveIntegerInput } from '../estimateFormDefaults';

export interface PositiveIntegerInputHandle {
  flushCommit: () => number | null;
}

interface Props {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  onDraftChange?: (raw: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}

const PositiveIntegerInput = forwardRef<PositiveIntegerInputHandle, Props>(function PositiveIntegerInput(
  {
    label,
    value,
    onCommit,
    onDraftChange,
    disabled = false,
    min = 1,
    max = 999,
  },
  ref,
) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      flushCommit: () => {
        const { display, committed } = commitPositiveIntegerInput(inputValue, value, { min, max });
        setInputValue(display);
        return committed;
      },
    }),
    [inputValue, value, min, max],
  );

  const handleBlur = () => {
    const { display, committed } = commitPositiveIntegerInput(inputValue, value, { min, max });
    setInputValue(display);
    if (committed !== null) {
      onCommit(committed);
    }
  };

  return (
    <Input
      label={label}
      type="number"
      min={min}
      max={max}
      step={1}
      value={inputValue}
      disabled={disabled}
      onChange={(event) => {
        setInputValue(event.target.value);
        onDraftChange?.(event.target.value);
      }}
      onBlur={handleBlur}
      fullWidth
    />
  );
});

export default PositiveIntegerInput;
