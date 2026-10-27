import { useEffect, useState, type RefObject } from "react";

/** Loads a little ahead of scrolling, so posters are usually ready as cards appear. */
const PRELOAD_MARGIN = "600px";

// One observer for every card instead of one per card.
const onVisible = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | undefined;

function sharedObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onVisible.get(entry.target)?.();
      }
    },
    { rootMargin: PRELOAD_MARGIN },
  );
  return observer;
}

/** True once the element has come near the viewport, and stays true after. */
export function useInView(ref: RefObject<Element | null>) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    const shared = sharedObserver();
    onVisible.set(element, () => setInView(true));
    shared.observe(element);
    return () => {
      shared.unobserve(element);
      onVisible.delete(element);
    };
  }, [ref, inView]);

  return inView;
}
