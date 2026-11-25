import { formatTimestamp } from '../lib/notes.js';
import { textLang } from '../lib/lang.js';

/** 註釋清單：「1. 註釋內容」，編號是連結，點了影片跳到 note.jumpTo（那句字幕的開頭） */
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
          </p>
        </li>
      ))}
    </ol>
  );
}
