# Building the ProView frontend source

The running frontend offers its source without a GitHub account at
`/source/frontend.tar.gz`, the GNU AGPL license at `/source/LICENSE.txt`, and
archive/file SHA-256 checksums at `/source/manifest.json`. The archive is generated
from the same source tree before every frontend build. This download remains
available when the development repository is private.

Extract the archive into a new directory. Install Node.js24.21.0 and pnpm10.34.6,
then run from that directory:

```sh
pnpm install --frozen-lockfile --filter @proview/web... --filter @proview/config...
PROVIEW_API_INTERNAL_URL=http://127.0.0.1:3001 pnpm --filter @proview/web build
pnpm --filter @proview/web start
```

The frontend runs on port3000. Its browser API calls use `/api/v1`; Next.js proxies
them to `PROVIEW_API_INTERNAL_URL`. Supply a compatible ProView REST service to
use authenticated academic workflows. The extracted frontend can be built and
its public pages viewed without the backend or production data. No backend
source, environment credentials, database dumps, private PDFs or runtime files
are included. Root workspace metadata and shared lint configuration are retained
to install the exact dependencies; root commands targeting the absent API are
not frontend build commands.

For provenance, modification dates, attribution and font licenses, see
`apps/web/NOTICE.md`, `apps/web/LICENSE.md`, `docs/upstream-openreview.md`,
`docs/openreview-adaptation.md`, and the font licenses under
`apps/web/public/{brand,fonts}`. The upstream baseline manifests are historical
evidence rather than active install inputs. The software is provided without
warranty as described in the license.

`SOURCE-FILES.json` records checksums of the input source files inside the
archive. Running another frontend build regenerates the download from your
modified tree, so operators do not offer a stale archive after local changes.
