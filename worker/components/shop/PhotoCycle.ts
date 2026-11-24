// worker/components/shop/PhotoCycle.ts
//
// <photo-cycle>: a collection card turning slowly through a piece's photos.
// The server renders the first photo visible and the rest hidden, with their
// URLs in data-src, so nothing extra downloads until it is about to be shown.
//
// Still under prefers-reduced-motion. Paused while the card is off screen or
// the tab is hidden. Cards start at different moments so a grid of them does
// not change all at once.

const INTERVAL = 4500;
const SHOWN = "opacity-100";
const HIDDEN = "opacity-0";

let started = 0;

class PhotoCycle extends HTMLElement {
  private timer?: ReturnType<typeof setTimeout>;
  private observer?: IntersectionObserver;
  private visible = false;
  private index = 0;
  private readonly offset = (started++ % 4) * 900;

  connectedCallback() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (this.photos.length < 2) return;
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule(this.offset + INTERVAL);
    });
    this.observer.observe(this);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    this.observer?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private get photos() {
    return [...this.querySelectorAll("img")];
  }

  private readonly onVisibility = () => this.schedule(INTERVAL);

  private schedule(delay: number) {
    clearTimeout(this.timer);
    if (!this.visible || document.hidden) return;
    // Fetch the next one now, so it is ready when its turn comes.
    this.load(this.photos[(this.index + 1) % this.photos.length]);
    this.timer = setTimeout(() => this.advance(), delay);
  }

  private load(img: HTMLImageElement) {
    if (img.dataset.src && !img.getAttribute("src")) img.src = img.dataset.src;
  }

  private advance() {
    const photos = this.photos;
    const next = photos[(this.index + 1) % photos.length];
    const show = () => {
      photos[this.index].classList.replace(SHOWN, HIDDEN);
      next.classList.replace(HIDDEN, SHOWN);
      this.index = (this.index + 1) % photos.length;
      this.schedule(INTERVAL);
    };
    const skip = () => {
      next.remove();
      this.schedule(INTERVAL);
    };
    // Never fade to a photo that has not arrived; drop one that failed.
    if (next.complete && next.naturalWidth) show();
    else if (next.complete && next.getAttribute("src")) skip();
    else {
      next.addEventListener("load", show, { once: true });
      next.addEventListener("error", skip, { once: true });
      this.load(next);
    }
  }
}

if (!customElements.get("photo-cycle")) customElements.define("photo-cycle", PhotoCycle);
export { PhotoCycle };
