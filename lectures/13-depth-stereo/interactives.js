/* Slide interactives specific to this lecture, small enough not to warrant a
   component of their own. Anything reused, or worth a sandbox, is a component. */

/* Two slides hold a clip still until it is asked to move.
   On both, the thing being taught IS the motion: a frozen aerial photograph
   looks flat and resolves into depth the moment it moves, and a still of the
   Ames room is just a photograph until someone walks across it. Autoplay
   spends that moment while the room is still reading the previous slide, so
   each clip waits on its poster and starts on a step — which means the arrow
   keys and a presenter's clicker drive it, not only a mouse. Clicking the
   video toggles it too.

   `rewind` is the one difference. The parallax clip returns to its first frame
   when paused, because the flat photograph is half its argument and has to be
   showable again. The Ames clip pauses where it is: it runs for 82 seconds and
   explains itself halfway through, so stopping on a frame to talk about it and
   then going on is the normal way to use it. */
function clipOnStep(root, cls, rewind){
  const v = root.querySelector('.' + cls + '-vid');
  const hint = root.querySelector('.' + cls + '-hint');
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
      if(rewind) v.currentTime = 0;
    }
    hint.style.opacity = on ? '0' : '1';
  }
  // the engine leaves click alone on a slide that has an init, so this is the
  // only handler on it and the click cannot also advance the slide
  v.addEventListener('click', () => set(on ? 0 : 1));
  set(0);
  HOST.registerSteps(root, { max: 1, get: () => on, set: set });
}

INIT.am = root => clipOnStep(root, 'am', false);   // the Ames room, slide 5
INIT.pl = root => clipOnStep(root, 'pl', true);    // motion parallax, slide 7

/* Components are spliced in by the shell; the lecture just names which slide
   key each one drives. See lectures/13-depth-stereo/components/. */
INIT.ss = initStereoSimilar;
INIT.gc = initGraphCut;
INIT.rc = initRectify;
INIT.sm = initScanline;
