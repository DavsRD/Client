# Pixel Pencil Cursor

A 16×16 pixel-art pencil, drawn at 2× (32 px), that replaces the mouse cursor. It shows a one-off sparkle when the pointer enters an interactive element and a 6-pixel burst on click. There are no dependencies.

## Files

| File | What it is |
|---|---|
| `pencil-cursor.js` | The cursor. The pencil sprite is embedded, so no image path needs configuring. |
| `pencil-cursor.css` | Cursor, sparkle and burst styles. The sparkle frames are embedded too. |
| `usePencilCursor.js` | React hook wrapper (optional). |
| `demo.html` | Test page: open it in a browser. |
| `assets/` | The same sprites as standalone files (`pencil-cursor.svg`, `pencil-cursor.png` 16 px, `pencil-cursor@2x.png` 32 px, `sparkle.svg`, `sparkle-small.svg`). Use these if you want to edit the art or point `spriteUrl` at your own copy. 

## Add it to a plain HTML site

Copy the folder into your site, then in every page (or your shared layout):

```html
<link rel="stylesheet" href="/pixel-pencil-cursor/pencil-cursor.css">
<script src="/pixel-pencil-cursor/pencil-cursor.js" defer></script>
```

It starts automatically. To start it yourself, add `data-manual` to the script tag and call:

```js
PixelPencilCursor.init({ releaseSparkle: true });
```

## Add it to a React app

```jsx
import './pixel-pencil-cursor/pencil-cursor.css';
import usePencilCursor from './pixel-pencil-cursor/usePencilCursor';

export default function App() {
  usePencilCursor();
  return <YourRoutes />;
}
```

The cursor is a singleton. Calling `init()` twice, React StrictMode and route changes never add a second cursor or duplicate listeners.

## Options

| Option | Default | |
|---|---|---|
| `hoverSparkle` | `true` | Sparkle at the tip when entering an interactive element |
| `clickBurst` | `true` | Pixel burst at the click point |
| `releaseSparkle` | `false` | Small sparkle at the click point on release |
| `spriteUrl` | embedded SVG | Your own sprite file (keep the tip at the hotspot) |
| `size` | `32` | Displayed size in CSS px |
| `hotspot` | `{x: 4, y: 4}` | Where the graphite tip sits inside the displayed sprite |
| `interactiveSelector` | links, buttons, form controls, ARIA roles, `[tabindex]`, `[onclick]`, `[data-cursor="interactive"]`, `.clickable` | What counts as interactive |
| `maxEffects` | `24` | Hard cap on sparkle and burst nodes on screen |

To make any element count as interactive (a clickable card, say), add `data-cursor="interactive"` to it. Elements that are disabled or have `aria-disabled="true"` don't sparkle.

## How it behaves

- **Idle:** a fixed, `pointer-events: none` element moves with `transform` on every `pointermove`. It has no easing and no rAF delay, so it doesn't lag. Its offset is set so the graphite tip lands exactly on the pointer.
- **Hover:** one delegated `pointerover` listener checks `closest(interactiveSelector)`. When the hovered element changes, a single 3-frame sparkle plays near the tip, at most one every 150 ms. Elements added to the page later are picked up automatically.
- **Press:** primary button only. The pencil shifts 2 px (one sprite pixel) while the button is held, and a burst plays at the exact click coordinates in its own layer. That's a centre flash plus 6 pixels stepping outward and fading over 300 ms. Holding the button doesn't repeat the burst.
- **Release:** the pencil snaps back. There's an optional small sparkle (`releaseSparkle`).
- **Native cursor:** it's hidden (`html.ppc-active`) only after the sprite has loaded *and* a real mouse has moved. If the sprite fails to load, the native cursor stays. A touch or pen press hands control back to the native pointer, and touch-only devices never hide it.
- **Reduced motion:** with `prefers-reduced-motion` on, there are no sparkles, no flying particles and no transitions; a click shows only a 140 ms static flash. This is re-checked live if the setting changes.
- **Leaving the window:** the pencil hides when the pointer leaves the window or the tab loses focus. During a native drag it keeps following via `dragover`.

## Limitations

- Inside `<iframe>`s from other sites the browser shows its own cursor, because no page script can reach them.
- While a native drag is in progress, the browser draws its own drag image next to the pencil.
- Text fields show the pencil instead of the I-beam. To keep the I-beam, add `html.ppc-active input, html.ppc-active textarea { cursor: text !important; }` and hide the pencil over them yourself.
