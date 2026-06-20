# offscreen-canvas-worker

a side-by-side demo comparing a three.js particle field rendered on the main thread (left) versus inside a web worker via offscreencanvas (right). drag the load slider to burn cpu on the main thread each frame and watch the left canvas, ui, and metrics stutter while the worker canvas keeps rendering smoothly.
