import { useEffect, useState } from 'react';

const PREFIX = 'ytsubs:';

/** 存在 localStorage 的偏好設定；無痕模式或封鎖儲存時退回預設值，不影響使用 */
export function useStoredState(key, initial, isValid = () => true) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      /* 忽略 */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* 忽略 */
    }
  }, [key, value]);

  return [value, setValue];
}
