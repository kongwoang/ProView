# ProView brand

The user supplied `proview_icon.png` and `[SysAd] Planning - Group3.pdf` on 2026-10-08. The proposal is design/background reference; the original implementation specifications remain the functional requirements.

The PDF embeds `Montserrat-ExtraBold` for the seven letters in ProView. The report body uses `VnURWPalladioL`; that document body font is not the product wordmark. PDF character colors identify navy `#0D1B3D` for Pro, and `#1565E8`, `#3757F0`, `#584AF7`, `#7A3CFF` across View. The website uses Montserrat weight800 and this blue-to-purple gradient. The light top header retains the original navy wordmark in the OpenReview-style layout.

`apps/web/public/brand/proview-icon.png` is an exact copy of the supplied transparent PNG, with no recoloring or raster edits. It appears in the shared brand component and browser/Apple icon metadata. Its SHA256 is `f89fb740c14be8ee110d841c993c868deddfc0986340221d8379cf5491f6b837`.

The self-hosted Montserrat variable font comes from [Google Fonts' Montserrat source](https://github.com/google/fonts/tree/main/ofl/montserrat). Git blob `c97aca18592834d8706549c279cb8d5ac5d85f69` supplies `Montserrat[wght].ttf`, saved as `Montserrat-Variable.ttf` (SHA256 `0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7`). The unchanged SIL Open Font License1.1 is retained at `apps/web/public/brand/Montserrat-OFL.txt`, from blob `fe576a2ee1f96353b05d030c0b7620d525cc53a8`.

Font/image requests are same-origin. No Google Fonts CDN, external font request or build-time font download is needed after cloning the repository. The rest of the interface uses a Helvetica/Arial system font stack for familiar academic forms; Montserrat ExtraBold is scoped to the brand wordmark.
