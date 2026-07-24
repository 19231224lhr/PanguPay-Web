import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import i18n from './i18n'
import router from './router'
import { initializePreferences } from './composables/usePreferences'
import './styles/tokens.css'
import './styles/base.css'
import './styles/motion.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

initializePreferences()

app.mount('#app')
