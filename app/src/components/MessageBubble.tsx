import React from "react";

type Props = {
  message: { mine: boolean; content?: string | null };
};

function MessageBubble({ message }: Props) {
  const mine = !!message.mine;
  const content = message.content ?? "";

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`p-2 max-w-xs rounded-lg break-words ${
          mine ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-100"
        }`}
        title={content}
        role="article"
        aria-label={mine ? "Wiadomość (moja)" : "Wiadomość"}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

export default React.memo(MessageBubble);
