-- Admin-written "choose an angle" text. When a row exists for a (tip, lens), the reader sees
-- this text in the analysis pane instead of an on-demand LLM call. One row per tip + lens;
-- lens is one of the keys in llm.ANALYSIS_LENSES (apply / avoid / opposing / misreadings / figures).
CREATE TABLE IF NOT EXISTS tip_analysis (
  tip_id INTEGER NOT NULL REFERENCES tips(id) ON DELETE CASCADE,
  lens   TEXT    NOT NULL,
  text   TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (tip_id, lens)
);
