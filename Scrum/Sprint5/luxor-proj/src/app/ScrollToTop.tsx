import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // AnimatePresence keeps the outgoing page briefly mounted. Retry after its
    // exit transition so anchors on Inicio are available from any route.
    const scrollToAnchor = () => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    scrollToAnchor();
    const retryId = window.setTimeout(scrollToAnchor, 360);
    return () => window.clearTimeout(retryId);
  }, [pathname, hash]);

  return null;
}
