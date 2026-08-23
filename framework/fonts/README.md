# Self-hosted fonts

Drop the woff2 files here and `build.py` switches from the Google Fonts stylesheet
to inline `@font-face` rules automatically — no other change needed.

Name them `Family_Name-weight.woff2`, underscores for spaces:

    Space_Grotesk-500.woff2   Space_Grotesk-600.woff2   Space_Grotesk-700.woff2
    Inter-400.woff2           Inter-500.woff2           Inter-600.woff2
    IBM_Plex_Mono-400.woff2   IBM_Plex_Mono-500.woff2

## Why bother

The deck currently pulls these from fonts.googleapis.com. That is a third-party
request on every load, it is one more thing a captive-portal network in a lecture
theatre can take away from you mid-talk, and the PDF renderer has no network at
all — which is why the shipped PDF has fallback typography rather than the real
faces. Roughly 100 KB self-hosted buys all three back.

Subset them first if you like; the decks use Latin only.
