CREATE TABLE IF NOT EXISTS status_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT NOT NULL, -- 'tip', 'quote', 'grammar_fact'
    author TEXT,
    source TEXT,
    last_shown_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_status_messages_last_shown_at ON status_messages(last_shown_at);

INSERT INTO status_messages (content, type) VALUES ('Tip: Use /undo to delete the last check.', 'tip');
INSERT INTO status_messages (content, type) VALUES ('Tip: /review helps you practice due cards.', 'tip');
INSERT INTO status_messages (content, type) VALUES ('"The limits of my language mean the limits of my world." — Ludwig Wittgenstein', 'quote');
INSERT INTO status_messages (content, type) VALUES ('Grammar Fact: "I am" is the shortest complete sentence in the English language.', 'grammar_fact');
