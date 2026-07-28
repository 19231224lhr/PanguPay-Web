import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'
import router from './router'
import { pinia } from './stores/pinia'
import { initializePreferences } from './composables/usePreferences'
import { installGatewayWalletEntryService } from './services/walletEntryGateway'
import './styles/tokens.css'
import './styles/base.css'
import './styles/motion.css'
import './styles/wallet.css'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)

installGatewayWalletEntryService()

initializePreferences()

app.mount('#app')
