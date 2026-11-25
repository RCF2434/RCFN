import { ExternalLink } from 'lucide-react';
import { formatTimestamp, noteUrlLabel } from '../lib/notes.js';
import { textLang } from '../lib/lang.js';

/**
 * 註釋清單：「1. 註釋內容」，編號是連結，點了影片跳到 note.jumpTo（那句字幕的開頭）。
 * 註釋有 url 時，在文字最後加上外連連結（開新分頁，顯示網域）。
 */
export default function NotesList({ notes, onJump }) {
  return (
    <ol className="notes">
      {notes.map((note) => (
        <li key={note.number} id={`note-${note.number}`} className="note">
          <a
            href={`#note-${note.number}`}
            className="note__jump"
            onClick={(event) => {
              event.preventDefault();
              onJump(note);
            }}
            title={`跳到 ${formatTimestamp(note.jumpTo ?? note.time)}`}
            aria-label={`註釋 ${note.number}，跳到影片 ${formatTimestamp(note.jumpTo ?? note.time)}`}
          >
            {note.number}.
          </a>
          <p className="note__text" lang={textLang(note.text)}>
            {note.text}
            {note.url && (
              <>
                {' '}
                <a
                  href={note.url}
                  className="note__link"
                  target="_blank"
                  rel="noopener noreferrer"
                  title={note.url}
                  lang="en"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {noteUrlLabel(note.url)}
                  <span className="visually-hidden">（開新分頁）</span>
                </a>
              </>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}
