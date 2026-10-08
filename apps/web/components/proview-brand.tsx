import Image from 'next/image';

/** Brand colors and Montserrat ExtraBold follow the supplied Group 3 proposal. */
export function ProViewBrand({ tagline = false }: { tagline?: boolean }) {
  return (
    <span className="proview-brand">
      <Image
        className="proview-brand-icon"
        src="/brand/proview-icon.png"
        width={40}
        height={40}
        alt=""
        unoptimized
        priority
      />
      <span className="proview-brand-text">
        <span className="proview-wordmark" aria-label="ProView">
          <span>Pro</span>
          <span className="proview-wordmark-view">View</span>
        </span>
        {tagline && <small>PROJECT REVIEW WORKSPACE</small>}
      </span>
    </span>
  );
}
