/** ALOHA UI-only, user-set attention priority. Never a medical severity score. */
export const concernAttentionOptions = [
  {value:'unset',label:'未设置',description:'不区分优先顺序'},
  {value:'routine',label:'日常关注',description:'按日常节奏持续观察'},
  {value:'watch',label:'重点关注',description:'希望更频繁地留意'},
  {value:'priority',label:'优先处理',description:'希望优先安排跟进'},
] as const
export type ConcernAttention = (typeof concernAttentionOptions)[number]['value']
export const attentionLabel = (level:ConcernAttention='unset')=>
  concernAttentionOptions.find(x=>x.value===level)?.label ?? '未设置'
export const attentionColor = (level:ConcernAttention='unset')=>
  'var(--health-attention-'+level+')'
export function parseConcernAttention(value:string):ConcernAttention {
  return (concernAttentionOptions.find(x=>x.value===value)?.value ?? 'unset')
}
