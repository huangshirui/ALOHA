// Named imports let the bundler remove unused ECharts charts and components.
import {init,use} from 'echarts/core'
import {LineChart} from 'echarts/charts'
import {GridComponent,TooltipComponent,DataZoomComponent,MarkLineComponent,MarkAreaComponent} from 'echarts/components'
import {SVGRenderer} from 'echarts/renderers'
use([LineChart,GridComponent,TooltipComponent,DataZoomComponent,MarkLineComponent,MarkAreaComponent,SVGRenderer])
export {init}
