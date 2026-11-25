/**
 * 文字含平假名或片假名就當成日文，給元素加 lang="ja"：
 * 字體改用 Noto Sans JP 優先，漢字顯示日文字形；螢幕閱讀器也會用日文唸。
 * 其他文字沿用頁面的 zh-Hant。
 */
const KANA = /[ぁ-ゖァ-ヺ]/;

export function textLang(text) {
  return KANA.test(text ?? '') ? 'ja' : undefined;
}
