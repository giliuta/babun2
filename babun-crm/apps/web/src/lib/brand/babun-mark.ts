// Single source of truth for the Babun mark (the baboon).
// Used by app/icon.tsx and app/apple-icon.tsx to render PNG icons,
// and mirrored as static SVG in /public/icon.svg + /public/icon-maskable.svg
// for the PWA manifest.
//
// Keep this in lockstep with public/icon.svg. If you tweak the mark,
// update both — the public SVG is what manifest.ts and the favicon
// chain reference, this is what the dynamic /icon and /apple-icon
// routes render through next/og + Satori.

const ROUNDED_BG_RX = 112;

const ROUNDED_BABOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#3A8DEA"/>
<stop offset="55%" stop-color="#1F66D7"/>
<stop offset="100%" stop-color="#1746A8"/>
</linearGradient>
<radialGradient id="bgGlow" cx="50%" cy="18%" r="65%">
<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.28"/>
<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
</radialGradient>
<linearGradient id="face" x1="50%" y1="0%" x2="50%" y2="100%">
<stop offset="0%" stop-color="#F7E6C7"/>
<stop offset="60%" stop-color="#E5CD9E"/>
<stop offset="100%" stop-color="#C29F6E"/>
</linearGradient>
<linearGradient id="mane" x1="0%" y1="0%" x2="0%" y2="100%">
<stop offset="0%" stop-color="#E89870"/>
<stop offset="55%" stop-color="#C66A45"/>
<stop offset="100%" stop-color="#7A2F1A"/>
</linearGradient>
<linearGradient id="ridge" x1="50%" y1="0%" x2="50%" y2="100%">
<stop offset="0%" stop-color="#E69BAB"/>
<stop offset="55%" stop-color="#B86E80"/>
<stop offset="100%" stop-color="#7E384C"/>
</linearGradient>
<radialGradient id="cheekGlow" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="#FFD3B0" stop-opacity="0.55"/>
<stop offset="100%" stop-color="#FFD3B0" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="512" height="512" rx="${ROUNDED_BG_RX}" fill="url(#bg)"/>
<rect width="512" height="512" rx="${ROUNDED_BG_RX}" fill="url(#bgGlow)"/>
<rect x="0.75" y="0.75" width="510.5" height="510.5" rx="111.25" fill="none" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="1.5"/>
<g transform="translate(0 -8)">
<ellipse cx="118" cy="222" rx="28" ry="38" fill="#C66A45"/>
<ellipse cx="118" cy="222" rx="13" ry="22" fill="#7E384C"/>
<ellipse cx="394" cy="222" rx="28" ry="38" fill="#C66A45"/>
<ellipse cx="394" cy="222" rx="13" ry="22" fill="#7E384C"/>
<path d="M 200 170 C 150 168, 98 202, 92 282 C 88 342, 132 384, 184 374 C 206 370, 220 350, 224 320 L 224 198 Z" fill="url(#mane)"/>
<path d="M 312 170 C 362 168, 414 202, 420 282 C 424 342, 380 384, 328 374 C 306 370, 292 350, 288 320 L 288 198 Z" fill="url(#mane)"/>
<path d="M 256 96 C 322 96, 364 142, 364 200 L 364 246 C 364 276, 350 308, 340 338 C 330 366, 310 396, 288 414 C 278 422, 268 426, 256 426 C 244 426, 234 422, 224 414 C 202 396, 182 366, 172 338 C 162 308, 148 276, 148 246 L 148 200 C 148 142, 190 96, 256 96 Z" fill="url(#face)"/>
<ellipse cx="200" cy="296" rx="42" ry="52" fill="url(#cheekGlow)"/>
<ellipse cx="312" cy="296" rx="42" ry="52" fill="url(#cheekGlow)"/>
<path d="M 224 188 C 222 184, 290 184, 288 188 L 294 364 C 294 388, 278 402, 256 402 C 234 402, 218 388, 218 364 Z" fill="url(#ridge)"/>
<path d="M 248 202 L 252 358 C 252 364, 246 364, 244 362 Z" fill="#FFFFFF" opacity="0.22"/>
<ellipse cx="244" cy="382" rx="6" ry="7" fill="#2A0F1A"/>
<ellipse cx="268" cy="382" rx="6" ry="7" fill="#2A0F1A"/>
<path d="M 226 416 Q 256 426, 286 416" stroke="#8E4A26" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.5"/>
<path d="M 178 232 Q 200 218, 220 234" stroke="#7A4520" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.6"/>
<path d="M 292 234 Q 312 218, 334 232" stroke="#7A4520" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.6"/>
<ellipse cx="208" cy="254" rx="22" ry="24" fill="#FFFFFF"/>
<ellipse cx="304" cy="254" rx="22" ry="24" fill="#FFFFFF"/>
<ellipse cx="208" cy="256" rx="14" ry="16" fill="#B85A28"/>
<ellipse cx="304" cy="256" rx="14" ry="16" fill="#B85A28"/>
<ellipse cx="208" cy="258" rx="9" ry="11" fill="#1A0E08"/>
<ellipse cx="304" cy="258" rx="9" ry="11" fill="#1A0E08"/>
</g>
</svg>`;

export const BABUN_MARK_SVG = ROUNDED_BABOON_SVG;

export const BABUN_MARK_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  ROUNDED_BABOON_SVG,
)}`;
