# ProView brand

The user supplied `proview_icon.png` and `[SysAd] Planning - Group3.pdf` on 2026-10-08. The proposal is design/background reference; the original implementation specifications remain the functional requirements.

The PDF embeds `Montserrat-ExtraBold` for the seven letters in ProView. The report body uses `VnURWPalladioL`; that document body font is not the product wordmark. PDF character colors identify navy `#0D1B3D` for Pro, and `#1565E8`, `#3757F0`, `#584AF7`, `#7A3CFF` across View. The website uses Montserrat weight800 and this blue-to-purple gradient. The navy OpenReview-style header uses a white Pro and lighter blue/purple View gradient for contrast, retaining Montserrat ExtraBold and the exact supplied colored icon. The standard brand component retains the original navy/gradient wordmark outside that header.

`apps/web/public/brand/proview-icon.png` is an exact copy of the supplied transparent PNG, with no recoloring or raster edits. It appears in the shared brand component and browser/Apple icon metadata. Its SHA256 is `f89fb740c14be8ee110d841c993c868deddfc0986340221d8379cf5491f6b837`.

The self-hosted Montserrat variable font comes from [Google Fonts' Montserrat source](https://github.com/google/fonts/tree/main/ofl/montserrat). Git blob `c97aca18592834d8706549c279cb8d5ac5d85f69` supplies `Montserrat[wght].ttf`, saved as `Montserrat-Variable.ttf` (SHA256 `0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7`). The unchanged SIL Open Font License1.1 is retained at `apps/web/public/brand/Montserrat-OFL.txt`, from blob `fe576a2ee1f96353b05d030c0b7620d525cc53a8`.

Font/image requests are same-origin. No Google Fonts CDN, external font request or build-time font download is needed after cloning the repository. Montserrat ExtraBold is scoped to the brand wordmark. The interface uses self-hosted Noto Sans, matching the font family actually loaded by OpenReview; text inputs and textareas retain its Helvetica/Arial treatment.

## OpenReview interface font

The official OpenReview pinned layout loads Noto Sans normal/italic at weights400/700. Direct inspection of the live login page on 2026-10-08 confirmed Noto Sans for headings/body, 36px regular login headings, maroon `#8C1B13` navigation, slate `#2C3A4A` headings and warm `#FFFDFA` content. Earlier Helvetica-only styling was corrected after the user's feedback. The user explicitly confirmed that ProView keeps the logo's navy/blue/purple palette rather than adopting OpenReview's maroon branding; reference colors are recorded for comparison only.

Noto Sans was downloaded from [Google Fonts' official source](https://github.com/google/fonts/tree/main/ofl/notosans), with the Git blob identity verified before conversion:

| Source                           | Git blob                                   | Original SHA256                                                    |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `NotoSans[wdth,wght].ttf`        | `75575046c015ff623a848096a15779867ba71453` | `bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d` |
| `NotoSans-Italic[wdth,wght].ttf` | `429692da4c3f2751f50bdfab7d0fdb3639717524` | `58e6e0ebd1931b29a365aa2d3e2ee9a9e831a3af7cf3ad1462d4e72154f0b291` |
| `OFL.txt`                        | `6843f31878c9945e1e71e1baa275546b4eefead8` | `cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a` |

Derived WOFF2 assets use FontTools4.66.1/Brotli1.2.0: subset first, then fix `wdth=100` while retaining the variable weight axis. Preserved ranges: U+0000–024F,0300–036F,1E00–1EFF,2000–206F,20A0–20CF,2100–214F,2190–21FF,25A0–25FF,2212,FFFD. The subset retains Latin/Vietnamese names, accents, layout features and font/copyright names. Characters outside these ranges use the system fallback. The unchanged SIL OFL is bundled at `/fonts/NotoSans-OFL.txt`. Fonts are committed assets; the production build performs no downloads or conversions.

| Asset                         |  Bytes | SHA256                                                             |
| ----------------------------- | -----: | ------------------------------------------------------------------ |
| `NotoSans-Latin.woff2`        | 149332 | `253c628964c6b9b5b83798b9ecd2cd20b1341686fff1d4267c98554f0b226e2d` |
| `NotoSans-Latin-Italic.woff2` | 165444 | `128506a97a7a734cbfac63259c4f9bad8048b0a64eb3b222d001592a22e9b3f3` |
