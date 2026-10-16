// React hook for the Pixel Pencil Cursor.
// Usage (once, near the root of your app):
//
//   import './pencil-cursor.css';
//   import usePencilCursor from './usePencilCursor';
//   export default function App() {
//     usePencilCursor();            // or usePencilCursor({ releaseSparkle: true })
//     return <Routes />;
//   }
//
// The cursor is a singleton: mounting the hook in several places, StrictMode
// double-effects and route changes never create a second cursor or duplicate listeners.
import { useEffect } from 'react';
import './pencil-cursor.js';

let users = 0;

export default function usePencilCursor(options) {
  useEffect(() => {
    const api = window.PixelPencilCursor;
    if (!api) return undefined;
    users += 1;
    api.init(options);
    return () => {
      users -= 1;
      if (users === 0) api.destroy();
    };
    // options are read once on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
