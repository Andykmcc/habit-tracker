import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initStore } from './store'

initStore()
createApp(App).mount('#app')
