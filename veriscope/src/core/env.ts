/** Runtime capability detection. The UI can also run in a plain browser (dev mode),
 *  where chrome.* APIs are absent — we degrade instead of crashing. */
export function isExtensionRuntime(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
}

export function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.storage?.local;
}
