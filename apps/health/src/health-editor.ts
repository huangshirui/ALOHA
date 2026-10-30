import { toRaw } from 'vue'

/** Vue proxies are not structured-cloneable; clone the original record before editing.
 * The draft is detached so Cancel never mutates the displayed persisted record.
 */
export function editableSnapshot<T extends object>(record:T):T {
  return structuredClone(toRaw(record))
}
