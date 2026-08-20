import { describe, it, expect } from 'vitest';
import { getInitials, getAvatarGradient } from './UserAvatar';

describe('UserAvatar helpers', () => {
  it('generates correct initials for single and multi-word names', () => {
    expect(getInitials('Gatluak James')).toBe('GJ');
    expect(getInitials('Admin')).toBe('AD');
    expect(getInitials('John Doe Smith')).toBe('JS');
    expect(getInitials('')).toBe('U');
  });

  it('generates consistent avatar gradient for any string key', () => {
    const g1 = getAvatarGradient('Gatluak James');
    const g2 = getAvatarGradient('Gatluak James');
    expect(g1).toBe(g2);
    expect(g1).toContain('linear-gradient');
  });
});
