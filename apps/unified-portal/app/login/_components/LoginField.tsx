// Shared input field styles — matches existing developer login exactly

export const inputClassName = 'w-full px-4 py-3.5 rounded-xl transition-all duration-200';

export const inputStyle: React.CSSProperties = {
  backgroundColor: '#0e1116',
  border: '1px solid rgba(212, 175, 55, 0.12)',
  color: '#e4e4e7',
  outline: 'none',
};

export const labelClassName = 'block text-sm font-medium mb-2';

export const labelStyle: React.CSSProperties = {
  color: '#a1a1aa',
};

export const primaryButtonClassName = 'w-full py-4 px-4 font-semibold rounded-xl transition-all duration-200';

export const primaryButtonStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
  color: '#0a0a0f',
  boxShadow: '0 4px 20px -4px rgba(212, 175, 55, 0.4)',
  cursor: 'pointer',
  border: 'none',
  fontFamily: 'inherit',
};

export const errorStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 13,
};

export function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(212, 175, 55, 0.35)';
  e.target.style.boxShadow = '0 0 0 3px rgba(212, 175, 55, 0.08)';
}

export function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = 'rgba(212, 175, 55, 0.12)';
  e.target.style.boxShadow = 'none';
}
