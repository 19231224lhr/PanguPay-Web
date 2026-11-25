<template>
  <div class="wallet-figure payment-figure" aria-hidden="true">
    <svg viewBox="0 0 160 128" fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round">
      <!-- Contactless reader, drawn in the same plane as the card. -->
      <g transform="matrix(.94 .27 -.52 .84 75 45)">
        <rect class="plate" y="5" width="78" height="55" rx="8" />
        <rect class="plate" width="78" height="54" rx="8" />
        <g class="signal">
          <path d="M54 23q5 5 0 10 M59 20q8 8 0 16 M64 17q11 11 0 22" />
        </g>
      </g>
      <g class="payment-card wallet-figure__float">
        <g transform="matrix(.94 .27 -.52 .84 45 14)">
          <rect class="plate" y="2" width="89" height="54" rx="6" />
          <rect class="plate" width="89" height="54" rx="6" />
          <rect x="11" y="12" width="17" height="12" rx="3" />
          <path d="M17 12v12m-6-6h6m6-6v6h5M12 37h23m6 0h10" />
          <path d="M12 43h14" opacity=".55" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.payment-figure {
  flex: none;
  aspect-ratio: 5 / 4;
  color: var(--text-muted);
}
svg {
  display: block;
  width: 100%;
  height: 100%;
}
.plate { fill: var(--figure-plate, var(--background)); }
.signal { opacity: .65; }
.payment-card {
  --wallet-figure-drift: 2px;
  --wallet-figure-lift: -3.5px;
}
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .payment-card, .signal {
    transition: transform 320ms cubic-bezier(.2,.8,.2,1), opacity 240ms ease;
  }
  .payment-figure:hover .payment-card { transform: translate(3px, 5px); }
  .payment-figure:hover .signal { opacity: 1; }
}
</style>
