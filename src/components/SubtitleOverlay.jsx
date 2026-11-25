import { colorOf, speakerVars } from '../lib/speakers.js';
import SubtitleText from './SubtitleText.jsx';
import { textLang } from '../lib/lang.js';

const NO_MARKERS = new Map();

/**
 * 疊在影片上的字幕層；每一行各自一個色塊，顏色由說話人決定。
 * markers：Map<cue.id, 註釋編號[]>，標示在那一句字幕最後一行的後面，例如「…（*1）」
 */
export default function SubtitleOverlay({ cues, colors, styleKey, scale = 1, markers = NO_MARKERS }) {
  return (
    <div className="sub-overlay" data-sub-style={styleKey} style={{ '--sub-scale': scale }}>
      {cues.map((cue) =>
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
  );
}
