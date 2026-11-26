import {defineConfig} from '@playwright/test'

export default defineConfig({
  testDir:'./test/browser',
  fullyParallel:true,
  timeout:45_000,
  use:{baseURL:'http://127.0.0.1:4179',browserName:'chromium',serviceWorkers:'block'},
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort',
    url:'http://127.0.0.1:4179/health/',
    env:{VITE_HEALTH_DATA_MODE:'live'},
    reuseExistingServer:false,
    timeout:120_000,
  },
  projects:[
    {name:'desktop',use:{viewport:{width:1280,height:900}}},
    {name:'mobile',use:{viewport:{width:375,height:812},isMobile:true,hasTouch:true}},
    {name:'tablet',use:{viewport:{width:768,height:1024},hasTouch:true}},
  ],
})
