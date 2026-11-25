import { createApp, nextTick } from 'vue'
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
import './styles/wallet-details.css'
import './styles/glass-controls.css'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(i18n)

installGatewayWalletEntryService()

initializePreferences()

app.mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void router.isReady().then(() => navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}wallet-shell-worker.js`,
    { updateViaCache: 'none' },
  )).catch(() => {
    // Loading the wallet normally remains available if the browser blocks caching.
  })
}

const exitProgress = document.querySelector<HTMLElement>(':root[data-wallet-exit] #wallet-exit-loading')
if (exitProgress) {
  const revealPage = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      exitProgress.dispatchEvent(new Event('wallet-exit-finished'))
    } else {
      exitProgress.addEventListener('animationend', () => {
        exitProgress.dispatchEvent(new Event('wallet-exit-finished'))
      }, { once: true })
    }
    exitProgress.classList.add('wallet-exit-progress--done')
    exitProgress.setAttribute('aria-hidden', 'true')
  }
  void router.isReady().then(() => nextTick(revealPage), revealPage)
}
