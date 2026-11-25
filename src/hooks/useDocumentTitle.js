import { useEffect } from 'react';

const SITE = '非官方字幕';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title}｜${SITE}` : SITE;
  }, [title]);
}
