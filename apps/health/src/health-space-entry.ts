/** ALOHA selected Space is a browser preference, never a LifeSpace Grant.
 * Health uses it only after fetching current authorized spaces from its BFF.
 * An unset/revoked preference must be explicitly configured in Settings;
 * never infer a person or silently pick the first available Space.
 * Legacy Health-only keys are intentionally NOT adopted; Settings is now the
 * explicit owner of the current ALOHA Space choice.
 */
export interface AuthorizedSpace {id:string}
export interface SpacePreference {getItem(key:string):string|null}
export function selectedAuthorizedHealthSpace(
  available:readonly AuthorizedSpace[],storage:SpacePreference,
):string|null {
  const stored=storage.getItem('aloha.space')
  return available.some(s=>s.id===stored)?stored:null
}
