import {describe,expect,it} from 'vitest'
import { attentionColor, attentionLabel, concernAttentionOptions, parseConcernAttention } from './concern-attention'

describe('ALOHA user attention preferences (not clinical severity)',()=>{
 it('exposes neutral / routine / watch / priority choices',()=>{
   expect(concernAttentionOptions.map(x=>x.value)).toEqual(['unset','routine','watch','priority'])
   expect(attentionLabel('unset')).toBe('未设置')
   expect(attentionLabel('watch')).toBe('重点关注')
 })
 it('never treats arbitrary user input as a valid severity',()=>{
   expect(parseConcernAttention('critical')).toBe('unset')
   expect(parseConcernAttention('')).toBe('unset')
   expect(parseConcernAttention('priority')).toBe('priority')
 })
 it('uses semantic, Health-scoped color variables rather than raw palettes in components',()=>{
   expect(attentionColor('routine')).toBe('var(--health-attention-routine)')
   expect(attentionColor('priority')).toBe('var(--health-attention-priority)')
 })
})
