/** ALOHA selected Space is a browser preference, never a LifeSpace Grant.
 * Health uses it only after fetching current authorized spaces from its BFF.
 * An unset/revoked preference must be explicitly configured in Settings;
 * never infer a person or silently pick the first available Space.
 */
export interface AuthorizedSpace {id:string}
export interface SpacePreference {getItem(key:string):string|null}
export function selectedAuthorizedHealthSpace(
  available:readonly AuthorizedSpace[],storage:SpacePreference,
):string|null {
  const stored=storage.getItem('aloha.space')||storage.getItem('aloha.health.space')
  return available.some(s=>s.id===stored)?stored:null
}
