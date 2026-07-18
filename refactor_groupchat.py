import re

with open('frontend/src/pages/GroupChat.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useVirtualizer import
if '@tanstack/react-virtual' not in content:
    content = content.replace('import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
                              'import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";\nimport { useVirtualizer } from "@tanstack/react-virtual";')

message_row_code = '''
const MessageRow = React.memo(function MessageRow({ message }) {
  return (
    <div className={`flex ${message.is_own ? "justify-end" : "justify-start"}`}>
      <div className={`sv-group-chat-message ${message.is_own ? "is-own" : ""}`}>
        <p className={`text-[11px] font-bold leading-tight ${message.is_own ? "text-emerald-50" : "text-emerald-600"}`}>
          {message.sender_username.split('@')[0].toUpperCase()}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-[1.35]">{message.message}</p>
        <div className={`mt-0.5 text-right text-[10px] ${message.is_own ? "text-emerald-100" : "text-slate-400"}`}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.message.id === next.message.id &&
    prev.message.is_edited === next.message.is_edited &&
    prev.message.reactions === next.message.reactions
  );
});

function MessageList({ messages }) {
  const parentRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // rough estimate; measureElement refines
    overscan: 10,
  });

  // Auto-scroll to bottom on new message IF user is at bottom.
  useEffect(() => {
    const wasInitialMount = prevMessageCountRef.current === 0;
    prevMessageCountRef.current = messages.length;
    if (wasInitialMount || isAtBottom) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, isAtBottom, virtualizer]);

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    setIsAtBottom(true);
  }, [virtualizer, messages.length]);

  return (
    <div ref={parentRef} onScroll={handleScroll} style={{ overflowY: "auto", height: "100%" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vi) => (
          <div
            key={messages[vi.index].id}
            ref={virtualizer.measureElement}
            data-index={vi.index}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
          >
            <MessageRow message={messages[vi.index]} />
          </div>
        ))}
      </div>
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="scroll-to-bottom-btn shadow-md"
          style={{ position: "sticky", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, backgroundColor: "#fff", padding: "4px 12px", borderRadius: "16px", fontSize: "12px", fontWeight: "bold" }}
        >
          ↓ Latest
        </button>
      )}
    </div>
  );
}
'''

content = re.sub(r'const renderMessage = \(item\) => \(\s*<div key=\{item\.id\}(.*?)\s*\);\n', message_row_code, content, flags=re.DOTALL)
content = content.replace('{messages.map(renderMessage)}', '<MessageList messages={messages} />')
content = content.replace('<div ref={threadEndRef} />', '')

with open('frontend/src/pages/GroupChat.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('GroupChat virtualization completed.')
