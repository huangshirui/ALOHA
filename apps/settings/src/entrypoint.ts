import {WorkerEntrypoint} from 'cloudflare:workers'
import {dispatchWorkspaceState,type WorkspaceStorageEnv} from './workspace-state'
export {WorkspaceState} from './workspace-state'
export {default} from './worker'

/** Only an explicit named Service Binding can reach this entrypoint.
 * The caller BFF has already verified the LifeSpace User. No mutation API.
 */
export class WorkspaceReader extends WorkerEntrypoint<WorkspaceStorageEnv>{
  async fetch(request:Request):Promise<Response>{
    return dispatchWorkspaceState(request,this.env,true)
  }
}
