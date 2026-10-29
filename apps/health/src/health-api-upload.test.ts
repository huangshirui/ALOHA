import {afterEach,describe,expect,it,vi} from 'vitest'
import {uploadHealthDocument,type FileUploadProgress} from './health-api'

afterEach(()=>vi.unstubAllGlobals())

describe('same-origin Health file upload progress',()=>{
  it('reports real byte transport and then the separate server finalization stage',async()=>{
    const events:FileUploadProgress[]=[]
    const actions:string[]=[]
    class SyntheticXHR {
      upload:{onprogress:((event:ProgressEvent)=>void)|null;
        onload:((event:ProgressEvent)=>void)|null}={onprogress:null,onload:null}
      onload:(()=>void)|null=null
      onerror:(()=>void)|null=null
      onabort:(()=>void)|null=null
      ontimeout:(()=>void)|null=null
      timeout=0
      status=201
      responseText=JSON.stringify({data:{id:'rec_synthetic',version:1}})
      withCredentials=false
      open(method:string,url:string){actions.push(method+' '+url)}
      send(body:FormData){
        expect(body.get('file')).toBeInstanceOf(File)
        expect(this.withCredentials).toBe(true)
        this.upload.onprogress?.({loaded:48,total:100,lengthComputable:true} as ProgressEvent)
        this.upload.onprogress?.({loaded:100,total:100,lengthComputable:true} as ProgressEvent)
        this.upload.onload?.({} as ProgressEvent)
        this.onload?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest',SyntheticXHR)
    const file=new File(['test'],'synthetic.pdf',{type:'application/pdf'})
    const saved=await uploadHealthDocument('spc_synthetic',file,{title:'Synthetic',documentType:'lab_report'},
      event=>events.push(event))
    expect(saved.id).toBe('rec_synthetic')
    expect(actions).toEqual(['POST /health/api/v1/spaces/spc_synthetic/documents/upload'])
    expect(events).toEqual([
      {phase:'uploading',percent:0},
      {phase:'uploading',percent:48},
      {phase:'uploading',percent:99},
      {phase:'processing',percent:100},
    ])
  })
  it('reports an honest unknown percentage when upload byte totals are unavailable',async()=>{
    const events:FileUploadProgress[]=[]
    class SyntheticXHR {
      upload:{onprogress:((event:ProgressEvent)=>void)|null;
        onload:((event:ProgressEvent)=>void)|null}={onprogress:null,onload:null}
      onload:(()=>void)|null=null
      onerror:(()=>void)|null=null
      ontimeout:(()=>void)|null=null
      onabort:(()=>void)|null=null
      status=503
      responseText=''
      withCredentials=false
      timeout=0
      open(){}
      send(){
        this.upload.onprogress?.({lengthComputable:false,loaded:1,total:0} as ProgressEvent)
        this.onload?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest',SyntheticXHR)
    await expect(uploadHealthDocument('spc_synthetic',
      new File(['test'],'synthetic.pdf',{type:'application/pdf'}),
      {title:'Synthetic',documentType:'lab_report'},event=>events.push(event))).rejects.toThrow('暂不可用')
    expect(events).toEqual([{phase:'uploading',percent:0},{phase:'uploading',percent:null}])
  })
})
