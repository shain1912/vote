interface PresentationLinkProps {
  url: string | null
}

/** Shows a link to a team's presentation materials, or a fallback if none was submitted yet. */
export function PresentationLink({ url }: PresentationLinkProps) {
  if (!url) {
    return <span className="presentation-link presentation-link--empty">아직 제출되지 않음</span>
  }

  return (
    <a className="presentation-link" href={url} target="_blank" rel="noreferrer noopener">
      발표자료 보기
    </a>
  )
}
