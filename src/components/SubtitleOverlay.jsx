import { colorOf, speakerVars } from '../lib/speakers.js';
import { LANG_BY_KEY, multiLangScale } from '../lib/subtitleTracks.js';
import SubtitleText from './SubtitleText.jsx';
import { textLang } from '../lib/lang.js';

const NO_MARKERS = new Map();

/**
 * 疊在影片上的字幕層；每一行各自一個色塊，顏色由說話人決定。
 * cues：目前該顯示的字幕（mergeTracks 合併過，每句帶 lang）
 * langs：勾選的語言（固定順序）；字幕依語言分組由上到下排列，第一個是主語言（字最大）
 * markers：Map<cue.id, 註釋編號[]>，只標在主語言那句最後一行的後面，例如「…（*1）」
 */
export default function SubtitleOverlay({ cues, langs, colors, styleKey, scale = 1, markers = NO_MARKERS }) {
  const groups = langs
    .map((lang) => ({ lang, cues: cues.filter((cue) => cue.lang === lang) }))
    .filter((group) => group.cues.length);

  return (
    <div
      className="sub-overlay"
      data-sub-style={styleKey}
      data-langs={langs.length}
      // 依勾選的語言數縮小（不是目前畫面上的組數），播放中字幕大小才不會跳來跳去
      style={{ '--sub-scale': scale * multiLangScale(langs.length) }}
    >
      {groups.map((group) => (
        <div
          key={group.lang}
          className={`sub-group${group.lang === langs[0] ? ' is-primary' : ''}`}
          lang={LANG_BY_KEY[group.lang]?.lang}
        >
          {group.cues.map((cue) =>
            cue.lines.map((line, i) => {
              const color = colorOf(colors, line.speaker);
              const notes = i === cue.lines.length - 1 ? markers.get(cue.id) : null;
              return (
                <div
                  key={`${cue.id}-${i}`}
                  className="sub-line sub-skin"
                  style={speakerVars(color)}
                  lang={textLang(line.text)}
                >
                  <SubtitleText text={line.text} />
                  {notes?.map((n) => (
                    <span key={n} className="sub-note">
                      （*{n}）
                    </span>
                  ))}
                </div>
              );
            }),
          )}
        </div>
      ))}
    </div>
  );
}
