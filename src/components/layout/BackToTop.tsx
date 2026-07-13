import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setIsVisible(window.scrollY > 400);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      onClick={scrollToTop}
    >
      <ArrowUp aria-hidden="true" />
    </button>
  );
}

export default BackToTop;
