<script setup lang="ts">
import { computed } from 'vue'
import { BadgeCheck, CalendarDays, ChevronRight, ClipboardCheck, Search } from 'lucide-vue-next'
import {
  groupTimeline,
  type TimelineEntry, type TimelineFilter, type TimelineKind,
} from '../health-timeline'

const props=defineProps<{
  entries:TimelineEntry[]
  selectedKind:TimelineFilter
  searchActive:boolean
}>()
const emit=defineEmits<{
  'update:selectedKind':[kind:TimelineFilter]
  open:[kind:TimelineKind,id:string]
}>()
const filters=[
  {id:'all' as TimelineFilter,label:'全部'},
  {id:'observation' as TimelineFilter,label:'测量'},
  {id:'event' as TimelineFilter,label:'事件'},
  {id:'assessment' as TimelineFilter,label:'评估'},
]
const kindIcon={observation:ClipboardCheck,event:CalendarDays,assessment:BadgeCheck}
const groups=computed(()=>groupTimeline(props.entries,props.selectedKind))
const counts=computed(()=>({
  all:props.entries.length,
  observation:props.entries.filter(e=>e.kind==='observation').length,
  event:props.entries.filter(e=>e.kind==='event').length,
  assessment:props.entries.filter(e=>e.kind==='assessment').length,
}))
</script>

<template>
  <section class="health-timeline" aria-label="按时间排列的健康记录">
    <div class="timeline-filters" role="group" aria-label="按记录类型筛选">
      <button v-for="option in filters" :key="option.id" type="button"
        :class="{active:selectedKind===option.id}" :aria-pressed="selectedKind===option.id"
        @click="emit('update:selectedKind',option.id)">
        {{ option.label }} <span class="timeline-filter-count">{{ counts[option.id] }}</span>
      </button>
    </div>

    <div v-if="groups.length" class="timeline-groups">
      <section v-for="month in groups" :key="month.key" class="timeline-month"
        :aria-label="month.label">
        <header class="timeline-month-heading">
          <h2>{{ month.label }}</h2>
          <span>{{ month.count }} 条记录</span>
        </header>
        <ol class="timeline-days">
          <li v-for="day in month.days" :key="day.date" class="timeline-day">
            <div class="timeline-date" :aria-label="day.date==='undated'?'未填写日期':day.date">
              <strong>{{ day.day }}</strong>
              <small>{{ day.weekday }}</small>
            </div>
            <ol class="timeline-day-items">
              <li v-for="entry in day.entries" :key="entry.kind+':'+entry.id" class="timeline-item">
                <div class="timeline-track" aria-hidden="true">
                  <span class="timeline-node"><component :is="kindIcon[entry.kind]" :size="15"/></span>
                </div>
                <button class="timeline-entry" type="button" @click="emit('open',entry.kind,entry.id)">
                  <span class="timeline-copy">
                    <small>{{ entry.meta }}</small>
                    <b>{{ entry.title }}</b>
                  </span>
                  <ChevronRight :size="17" class="timeline-entry-chevron"/>
                </button>
              </li>
            </ol>
          </li>
        </ol>
      </section>
    </div>
    <div v-else class="timeline-empty" role="status">
      <Search :size="23"/>
      <strong>{{ searchActive?'没有找到相关记录':selectedKind==='all'?'还没有健康记录':'还没有此类记录' }}</strong>
      <span>{{ searchActive?'换个关键词，或切换记录类型。':'你新增的测量、健康事件和评估会按日期出现在这里。' }}</span>
    </div>
  </section>
</template>

<style scoped>
.health-timeline {min-width:0;}
.timeline-filters {display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;margin:0 0 var(--health-space-5);}
.timeline-filters button {
  display:inline-flex;align-items:center;gap:.35rem;min-height:2.35rem;
  border:1px solid transparent;border-radius:var(--health-radius-pill);padding:.42rem .8rem;
  background:transparent;color:var(--health-muted);font-size:var(--health-type-label);font-weight:570;
}
.timeline-filters button.active {
  border-color:var(--health-border);background:var(--health-surface);color:var(--health-brand-strong);font-weight:700;
}
.timeline-filters button:hover:not(.active) {background:var(--health-surface-secondary);color:var(--health-ink);}
.timeline-filters button:focus-visible,.timeline-entry:focus-visible {
  outline:2px solid var(--health-brand);outline-offset:2px;
}
.timeline-filter-count {font-size:var(--health-type-caption);color:var(--health-muted);font-variant-numeric:tabular-nums;}
.timeline-groups {display:grid;gap:var(--health-space-6);}
.timeline-month-heading {display:flex;align-items:baseline;gap:.85rem;margin:0 0 .65rem;padding:0 .2rem;}
.timeline-month-heading h2 {margin:0;font-size:var(--health-type-section);font-weight:740;color:var(--health-ink);}
.timeline-month-heading span {font-size:var(--health-type-caption);color:var(--health-muted);}
.timeline-days,.timeline-day-items {list-style:none;padding:0;margin:0;}
.timeline-day {display:grid;grid-template-columns:3.5rem minmax(0,1fr);column-gap:.65rem;min-width:0;}
.timeline-date {padding-top:.82rem;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:.16rem;}
.timeline-date strong {font-size:1.18rem;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums;color:var(--health-ink);}
.timeline-date small {font-size:var(--health-type-caption);color:var(--health-muted);}
.timeline-day-items {min-width:0;}
.timeline-item {display:grid;grid-template-columns:1.75rem minmax(0,1fr);min-height:4.9rem;}
.timeline-track {position:relative;display:flex;justify-content:center;align-items:flex-start;padding-top:.62rem;}
.timeline-track::before {
  content:'';position:absolute;top:0;bottom:0;left:50%;width:1px;
  background:var(--health-border);transform:translateX(-50%);
}
.timeline-node {
  position:relative;z-index:1;display:grid;place-items:center;width:1.6rem;height:1.6rem;
  border:1px solid color-mix(in srgb,var(--health-brand) 22%,var(--health-border));
  border-radius:50%;color:var(--health-brand-strong);background:var(--health-surface);
}
.timeline-entry {
  display:flex;align-items:center;justify-content:space-between;gap:.75rem;min-width:0;
  margin:0 0 .55rem;padding:.8rem 1rem;border:1px solid var(--health-border-soft);
  border-radius:var(--health-radius-control);background:var(--health-surface);
  color:var(--health-ink);text-align:left;
}
.timeline-entry:hover {border-color:var(--health-border);background:var(--health-surface-secondary);}
.timeline-copy {display:flex;flex:1;min-width:0;flex-direction:column;gap:.24rem;}
.timeline-copy small {font-size:var(--health-type-caption);color:var(--health-muted);line-height:1.4;}
.timeline-copy b {font-size:var(--health-type-body);font-weight:665;line-height:1.45;overflow-wrap:anywhere;}
.timeline-entry-chevron {flex:none;color:var(--health-muted);}
.timeline-empty {
  display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.6rem;
  min-height:12rem;padding:2rem 1rem;border:1px dashed var(--health-border);
  border-radius:var(--health-radius-card);background:var(--health-surface);color:var(--health-muted);text-align:center;
}
.timeline-empty strong {color:var(--health-ink);font-size:var(--health-type-body);}
.timeline-empty span {font-size:var(--health-type-caption);line-height:1.6;}
@media(max-width:47.999rem){
  .timeline-filters {gap:.2rem;margin-bottom:var(--health-space-4);}
  .timeline-filters button {padding:.42rem .65rem;}
  .timeline-day {grid-template-columns:2.7rem minmax(0,1fr);column-gap:.35rem;}
  .timeline-date strong {font-size:1.02rem;}
  .timeline-item {grid-template-columns:1.45rem minmax(0,1fr);}
  .timeline-node {width:1.4rem;height:1.4rem;}
  .timeline-entry {padding:.7rem .65rem;gap:.35rem;}
}
</style>
