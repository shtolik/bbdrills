import { h, render } from 'preact';
import App from './App';

// expose YT API flag (kept from original)
(window as any)._bbdrills_yt_api_ready = false;
(function loadYtApi() {
  if ((window as any).YT && (window as any).YT.Player) {
    (window as any)._bbdrills_yt_api_ready = true;
    return;
  }
  const s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.async = true;
  document.head.appendChild(s);
  (window as any).onYouTubeIframeAPIReady = function () {
    (window as any)._bbdrills_yt_api_ready = true;
  };
})();

render(<App />, document.getElementById('content')!);
