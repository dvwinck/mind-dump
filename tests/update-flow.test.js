import { describe, it, expect } from 'vitest';
import { controllerChangeAction } from '../src/update-flow.js';

const base = { hadController: true, updateRequested: false, reloading: false, hasDraft: false };
const decide = (over) => controllerChangeAction({ ...base, ...over });

describe('controllerChangeAction', () => {
  it('ignores the claim on the very first visit', () => {
    expect(decide({ hadController: false })).toBe('ignore');
  });

  it('reloads when this tab asked for the update, even with a draft', () => {
    expect(decide({ updateRequested: true, hasDraft: true })).toBe('reload');
  });

  it('reloads a first-visit tab once the user asked for an update', () => {
    expect(decide({ hadController: false, updateRequested: true })).toBe('reload');
  });

  it('reloads another tab that has nothing unsaved', () => {
    expect(decide({})).toBe('reload');
  });

  it('asks before reloading another tab that has an unsaved draft', () => {
    expect(decide({ hasDraft: true })).toBe('prompt');
  });

  it('never reloads twice', () => {
    expect(decide({ reloading: true, updateRequested: true })).toBe('ignore');
  });
});
