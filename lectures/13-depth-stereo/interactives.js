/* Slide interactives specific to this lecture, small enough not to warrant a
   component of their own. Anything reused, or worth a sandbox, is a component. */

/* Motion parallax holds still until it is asked to move.
   The cue IS the motion: a frozen aerial photograph looks flat, and the same
   photograph in motion resolves into depth at once. Autoplay spends that
   moment while the room is still reading the previous slide, so the clip waits
   on the poster and starts on a step — which means the arrow keys and a
   presenter's clicker drive it, not only a mouse. Clicking the video toggles
   it as well, and pausing returns to the first frame so the flatness can be
   shown back. */
function initParallax(root){
  const v = root.querySelector('.pl-vid');
  const hint = root.querySelector('.pl-hint');
  let on = 0;
  function set(n){
    on = n < 0 ? 0 : n > 1 ? 1 : n;
    if(on){
      // play() rejects in contexts with no media stack, such as the printable
      // render; the poster still stands in, so there is nothing to recover from
      const p = v.play();
      if(p && p.catch) p.catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
    hint.style.opacity = on ? '0' : '1';
  }
  // the engine leaves click alone on a slide that has an init, so this is the
  // only handler on it and the click cannot also advance the slide
  v.addEventListener('click', () => set(on ? 0 : 1));
  set(0);
  HOST.registerSteps(root, { max: 1, get: () => on, set: set });
}

INIT.pl = initParallax;

/* Components are spliced in by the shell; the lecture just names which slide
   key each one drives. See lectures/13-depth-stereo/components/. */
INIT.ss = initStereoSimilar;
INIT.gc = initGraphCut;
INIT.rc = initRectify;
INIT.sm = initScanline;
