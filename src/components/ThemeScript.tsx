import { LANG_SCRIPT } from '@/lib/i18n';

/* Theme and language are both settled before the first paint, so nothing flashes or switches. */
const script = `(function(){try{var t=localStorage.getItem('bepair-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}${LANG_SCRIPT}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
