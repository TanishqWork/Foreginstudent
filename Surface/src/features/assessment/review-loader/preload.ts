/** Starts downloading the animation chunk (GSAP + story) before it is needed. */
export function preloadReviewLoader() {
  void import('./story')
}
