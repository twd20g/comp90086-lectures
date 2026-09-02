/* No lecture-specific interactives yet. The two planned camera components are
   marked with .todo placeholders in slides.html:

     · live Hough      — camera frame -> Canny -> (rho, theta) accumulator ->
                         peaks -> lines drawn back on the frame
     · live homography — capture two views, detect and match features, fit a
                         homography with RANSAC, show inliers and the warp

   Both want a component in components/ with a sandbox, not an entry here. */
INIT.hv = initHoughVote;
INIT.hg = initHoughLive;
INIT.rl = initRansacLine;
