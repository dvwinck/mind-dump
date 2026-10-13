/**
 * Mind Dump - Update flow
 * Decides what a tab does when a new service worker takes control of it.
 */

/**
 * @param {Object} state
 * @param {boolean} state.hadController  the page was already controlled when it loaded (not a first visit)
 * @param {boolean} state.updateRequested the user clicked "Atualizar" in THIS tab
 * @param {boolean} state.reloading       a reload is already under way
 * @param {boolean} state.hasDraft        this tab holds text the user has not saved
 * @returns {'ignore'|'reload'|'prompt'}
 */
export function controllerChangeAction({ hadController, updateRequested, reloading, hasDraft }) {
  if (reloading) return 'ignore';
  if (updateRequested) return 'reload';
  if (!hadController) return 'ignore'; // first visit: the worker is just claiming the page
  // Another tab accepted the update: reload this one unless that would throw away typed text.
  return hasDraft ? 'prompt' : 'reload';
}
