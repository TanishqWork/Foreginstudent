/** Starts downloading the animation chunk (GSAP + story) before it is needed. */
export function preloadJourneyLoader() {
  void import('./journey')
}
