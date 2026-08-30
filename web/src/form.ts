import type { Dispatch, SetStateAction } from 'react';

export function createFormFieldChangeHandler<T extends object>(setForm: Dispatch<SetStateAction<T>>) {
  return (key: keyof T) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
}
