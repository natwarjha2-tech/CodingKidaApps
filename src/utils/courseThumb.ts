// Shared course thumbnail resolver — one source of truth for the per-subject
// image/emoji shown on course cards across screens (Courses, Enrolled Courses,
// Profile, Watchlist). Prefers a real subject image (C / Java / Python jpeg);
// falls back to a subject emoji for everything else. Mirrors the desktop
// getSubjectTheme mapping. Loaded with try/catch so a missing asset never
// crashes — it just falls back to the emoji.
//
// NOTE: SVG banners (DSA/Web/Robotics/AI) live only in the Courses grid where
// react-native-svg-transformer is set up for full-width banners. For the small
// round course icons used on the other screens, a real image or emoji is the
// right fit, so this helper intentionally returns image | emoji only.

let imgC: any = null, imgJava: any = null, imgPython: any = null, imgAI: any = null;
try { imgC = require('../../assets/courses/c.jpeg'); } catch {}
try { imgJava = require('../../assets/courses/java.jpeg'); } catch {}
try { imgPython = require('../../assets/courses/python.jpeg'); } catch {}
try { imgAI = require('../../assets/logos/ai.png'); } catch {}

export interface CourseThumb {
  img: any | null;   // real image source (require) when available, else null
  icon: string;      // emoji fallback (also used as a small overlay when desired)
  tint: string;      // soft background tint for the icon wrap
}

export function courseThumb(title?: string): CourseThumb {
  const t = (title || '').toLowerCase().trim();
  if (t.includes('python')) return { img: imgPython, icon: '🐍', tint: '#E4EEF7' };
  if (t.includes('java') && !t.includes('javascript')) return { img: imgJava, icon: '☕', tint: '#FDE7E7' };
  if (t === 'c' || t.startsWith('c ') || t.includes('c programming') || t.includes('c lang')) return { img: imgC, icon: 'C', tint: '#E4F8EC' };
  if (t.includes('artificial') || t === 'ai' || t.startsWith('ai ') || t.includes(' ai') || t.includes('intelligence') || t.includes('machine learning')) return { img: imgAI, icon: '🧠', tint: '#FCE4F1' };
  if (t.includes('javascript') || t.includes(' js')) return { img: null, icon: '📜', tint: '#FFF6D6' };
  if (t.includes('dsa') || t.includes('data structure') || t.includes('algorithm')) return { img: null, icon: '🧩', tint: '#EEE9FF' };
  if (t.includes('web') || t.includes('html')) return { img: null, icon: '🌐', tint: '#E4F1FB' };
  if (t.includes('react')) return { img: null, icon: '⚛️', tint: '#E1F3FB' };
  if (t.includes('robot')) return { img: null, icon: '🤖', tint: '#EAECEF' };
  if (t.includes('problem')) return { img: null, icon: '💡', tint: '#E4F8EC' };
  if (t.includes('scratch') || t.includes('game') || t.includes('kid')) return { img: null, icon: '🎮', tint: '#FFF3DC' };
  return { img: null, icon: '📘', tint: '#EEE9FF' };
}
