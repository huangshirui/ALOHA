import type {WorkspaceView} from '@aloha/contracts'
/** Consume only a verified cloud binding; never guess from membership list or browser storage. */
export function selectedAuthorizedHealthSpace(view:WorkspaceView):string|null{
  if(view.status!=='bound'||!view.space)return null
  return view.spaces.some(s=>s.id===view.space?.id)?view.space.id:null
}
