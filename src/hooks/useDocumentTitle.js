import { useEffect } from 'react';

const SITE = 'RCFN · 非官方字幕';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title}｜${SITE}` : SITE;
  }, [title]);
}
