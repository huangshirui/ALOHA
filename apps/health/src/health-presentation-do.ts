/**
 * ALOHA-owned Health presentation state. One SQLite-backed DO instance per verified
 * LifeSpace user; rows are further scoped by Space, Person, and Concern.
 */
import { parsePresentationPatch, presentationFromRow, type PresentationRow } from './health-presentation'

type SqlValue = string | number | null
export interface PresentationSql {
  exec<T extends object = Record<string, unknown>>(sql:string,...values:SqlValue[]):{toArray():T[]}
}
export interface PresentationObjectState { storage:{sql:PresentationSql} }
const schema=[
  'CREATE TABLE IF NOT EXISTS health_concern_presentation (',
  'space_id TEXT NOT NULL, person_id TEXT NOT NULL, concern_id TEXT NOT NULL,',
  "attention TEXT NOT NULL DEFAULT 'unset' CHECK (attention IN ('unset','routine','watch','priority')),",
  "view TEXT CHECK (view IS NULL OR view IN ('front','back')),",
  'asset_id TEXT, x REAL CHECK (x IS NULL OR (x >= 0 AND x <= 1)),',
  'y REAL CHECK (y IS NULL OR (y >= 0 AND y <= 1)),',
  'updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,',
  'PRIMARY KEY (space_id,person_id,concern_id),',
  'CHECK ((view IS NULL AND asset_id IS NULL AND x IS NULL AND y IS NULL)',
  'OR (view IS NOT NULL AND asset_id IS NOT NULL AND x IS NOT NULL AND y IS NOT NULL)))',
].join(' ')
const recordId=/^[A-Za-z][A-Za-z0-9_-]{2,127}$/
const spaceId=/^spc_[A-Za-z0-9_-]+$/
const personId=/^per_[A-Za-z0-9_-]+$/
const obj=(v:unknown):v is Record<string,unknown> =>
  !!v && typeof v==='object' && !Array.isArray(v)
const json=(data:unknown,status=200) =>
  Response.json({data},{status,headers:{'Cache-Control':'no-store'}})

/** No public route reaches this class. The trusted Health Worker owns its DO binding. */
export class HealthPresentationState {
  private readonly sql:PresentationSql
  constructor(state:PresentationObjectState,_env?:unknown) {
    this.sql=state.storage.sql
    this.sql.exec(schema)
  }
  async fetch(request:Request):Promise<Response> {
    const path=new URL(request.url).pathname
    if(request.method!=='POST'||!['/list','/patch','/delete'].includes(path))
      return json({error:'not_found'},404)
    let payload:unknown
    try {
      if(Number(request.headers.get('Content-Length')??0)>8192) return json({error:'too_large'},413)
      const body=await request.text()
      if(body.length>8192)return json({error:'too_large'},413)
      payload=JSON.parse(body)
    } catch {return json({error:'invalid_body'},400)}
    if(!obj(payload)||typeof payload.spaceId!=='string'||!spaceId.test(payload.spaceId)||
      typeof payload.personId!=='string'||!personId.test(payload.personId))
      return json({error:'invalid_scope'},400)
    const space=payload.spaceId,person=payload.personId
    try {
      if(path==='/list') {
        const rows=this.sql.exec<PresentationRow>(
          'SELECT concern_id,attention,view,asset_id,x,y FROM health_concern_presentation WHERE space_id=? AND person_id=?',
          space,person,
        ).toArray()
        return json({items:rows.map(presentationFromRow)})
      }
      if(typeof payload.concernId!=='string'||!recordId.test(payload.concernId))
        return json({error:'invalid_concern'},400)
      const concern=payload.concernId
      if(path==='/delete') {
        this.sql.exec(
          'DELETE FROM health_concern_presentation WHERE space_id=? AND person_id=? AND concern_id=?',
          space,person,concern,
        )
        return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}})
      }
      let patch
      try {patch=parsePresentationPatch(payload.patch,concern)}
      catch {return json({error:'invalid_presentation'},422)}
      const position=patch.placement
      const updateAttention=patch.attention===undefined?0:1
      const updatePlacement=position===undefined?0:1
      // One SQL upsert is atomic. Partial updates do not overwrite unrelated state.
      this.sql.exec(
        'INSERT INTO health_concern_presentation '+
        '(space_id,person_id,concern_id,attention,view,asset_id,x,y) VALUES (?,?,?,?,?,?,?,?) '+
        'ON CONFLICT(space_id,person_id,concern_id) DO UPDATE SET '+
        'attention=CASE WHEN ?=1 THEN excluded.attention ELSE health_concern_presentation.attention END, '+
        'view=CASE WHEN ?=1 THEN excluded.view ELSE health_concern_presentation.view END, '+
        'asset_id=CASE WHEN ?=1 THEN excluded.asset_id ELSE health_concern_presentation.asset_id END, '+
        'x=CASE WHEN ?=1 THEN excluded.x ELSE health_concern_presentation.x END, '+
        'y=CASE WHEN ?=1 THEN excluded.y ELSE health_concern_presentation.y END, '+
        'updated_at=CURRENT_TIMESTAMP',
        space,person,concern,patch.attention??'unset',
        position?.view??null,position?.assetId??null,
        position?.point.x??null,position?.point.y??null,
        updateAttention,updatePlacement,updatePlacement,updatePlacement,updatePlacement,
      )
      const rows=this.sql.exec<PresentationRow>(
        'SELECT concern_id,attention,view,asset_id,x,y FROM health_concern_presentation WHERE space_id=? AND person_id=? AND concern_id=?',
        space,person,concern,
      ).toArray()
      if(!rows[0])return json({error:'storage_read_failed'},503)
      return json(presentationFromRow(rows[0]))
    } catch { return json({error:'storage_unavailable'},503) }
  }
}
