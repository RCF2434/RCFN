import { createElement, useMemo } from 'react';
import { parseInline } from '../lib/srt.js';

function render(nodes, prefix) {
  return nodes.map((node, i) =>
    typeof node === 'string'
      ? node
      : createElement(node.tag, { key: `${prefix}${i}` }, render(node.children, `${prefix}${i}.`)),
  );
}

/** 安全地渲染 <i> <b> <u>，不使用 innerHTML */
export default function SubtitleText({ text }) {
  const nodes = useMemo(() => parseInline(text), [text]);
  return render(nodes, '');
}
