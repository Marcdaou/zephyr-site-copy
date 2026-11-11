# ZEPHYR site

A one-page scroll site for ZEPHYR sparkling botanical soda. React, Tailwind CSS v4, three.js through React Three Fiber, and Lenis for smooth scrolling. No backend.

## Run it

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # production build in dist/

## How the scroll works

- `src/scroll.ts` measures where each section starts and turns the scroll position into a float section index (2.5 = halfway between the third and fourth sections).
- `src/scene/HeroCan.tsx` holds one pose per story section (`STORY_POSES`). Between sections the can spins one full turn, swoops towards the camera and leans into the move. In the last leg it stands upright over the empty pedestal and drops onto it.
- `src/scene/Podium.tsx` places the podium as if it were part of the lineup section, so it scrolls in with the page. The three waiting cans hop when the Yuzu can lands.
- Page colours per section live in `src/data.ts`.

The can models in `public/models/` are copied from `3D Items/zephyr_can/web/models/`.
