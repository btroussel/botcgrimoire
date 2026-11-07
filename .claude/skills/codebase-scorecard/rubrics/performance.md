# Performance

Grade the production build, not the development server: the bundle and caching differ.

## Performance and offline

- **Bundle.** List the largest files in the build output and what makes them large.
- **Load.** With Playwright, time a cold load and a warm load to the first usable screen, once
  without throttling and once with the CPU slowed four times (CDP `Emulation.setCPUThrottlingRate`).
- **Interaction.** On the busiest screen, the most common action responds without a long task over
  200 ms (`PerformanceObserver` on `longtask`).
- **Offline.** If the product promises offline use: load once, go offline
  (`context.setOffline(true)`), reload, and walk the main journey. Every step must work. If it makes
  no such promise, say so and grade performance alone.
- **Updates.** A new release replaces the cached one without losing saved data. Check the
  mechanism in the code.
