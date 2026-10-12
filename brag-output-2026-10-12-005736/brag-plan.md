# Wayfinder — from feeling lost to a first step

What: a browser-based life map that connects goals to the steps they depend on.
Audience: people who have ambitions but cannot see where to begin, in work or the rest of life.
Difference: the Wafflehouse-inspired 5/3/1-year planning flow, explicit prerequisites, knots for unknowns, and actionable daily scheduling. No signup; browser storage and exportable JSON backups.
Strongest supported claim: a step becomes ready after its prerequisites are complete.
Visual hook: an actual map turns into a next action, using the product’s blue graph-paper identity.
Real flow: Vision → connected Map → ready action in Week → complete.
Tone: warm, precise, polished. Context leads; retro typography supports it.
Caption: I built Wayfinder for the gap between knowing you want something different and knowing what to do today.

## Improvement over the original
Use the real running app rather than reconstructed window cards. Restore the actual Y2K Blue palette. Replace the Windows 98 premise and unsupported permanence claims with the life-planning use case. Show prerequisite completion changing what is ready. End with the public URL.

## Storyboard — 22 seconds, 1920 × 1080, 30 fps
| Time | Scene | Content / motion |
|---|---|---|
| 0–3 | Hook | “Feeling lost? Map a way forward.” Brand and actual blank-map UI enter; text settles by 0.35s. |
| 3–8 | Vision | “Picture five years ahead.” / “Then work backward: 5 → 3 → 1.” The real Vision screen types a short illustrative future and reveals three goal horizons. |
| 8–14 | Map | “See what comes first.” / “Connect prerequisites. Untangle the knots.” Real cards assemble, a prerequisite connection is made, and completing Choose one meaningful project makes Share a first, small version ready. |
| 14–18 | Week | “One step for today.” / “Keep going. Review each week.” The real Week screen shows the newly ready step, then marks it complete. |
| 18–22 | Outro | Wayfinder. “Start where you are.” Public URL and “No signup. Browser saved.” hold on a quiet blue grid. |

Visuals: actual app source and styles copied into work/app; source fonts cached locally from the previous render. Ink #1a2a4a, sky #7dd3f7, yellow #ffe040, mint #b8f5d8, pink #ffb8d4; VT323 + Nunito. The video wrapper only crops and frames actual UI.
Motion: pure function of time. Short dip to the background at scene changes; no muddy crossfades. Cursor targets actual controls.
Audio: original, deterministic D-major instrumental; soft keys, bass, restrained drums and quiet in-key UI notes. Normalize integrated mix to -16 LUFS, ceiling -1.5 dBTP.
Poster: settled map scene, replacing frame 0 without changing duration.
QA: inspect each scene and mid-transitions before all-frame capture; verify output dimensions, frame count, duration, audio peak and frame-0 match.
