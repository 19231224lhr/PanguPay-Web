# Curve marks

A small SVG component shared by source between PanguPay-Web and PanguPay-Console.
Keep `src/components/CurveMark.vue` identical in both repositories when changing it.

Design reference: https://paidax01.github.io/math-curve-loaders/
The component is an original implementation of mathematical curves, not a copied gallery bundle.
No runtime dependency is added.

- `rose`: entrance ornament, slow orbit with tapered particles.
- `link`: connection/synchronization, fixed infinity silhouette.
- `weave`: processing/verification feedback.
- `motion="once"` with a slot: brief orbit around a semantic icon, then a static ring and icon.
- `motion="still"`: static composition.
- Parent supplies accessible status text; the ornament is hidden from assistive technology.
- IntersectionObserver and document visibility pause work without resetting phase.
- Reduced motion renders a static mark, responds to preference changes, and queues no frames.
- Unmount disconnects observers/listeners and cancels pending frames.

The surrounding typography, controls, authentication, and large particle scene are unchanged.
