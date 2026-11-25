import { useGuideCopy } from "./learner-language";
import { Icon } from "./Icon";
import { AudioButton } from "./AudioButton";
import { CopyButton } from "./CopyButton";

export function WordDetails({ entry, examples, showWord = true }: { entry: any; examples: string[]; showWord?: boolean }) {
  const { t } = useGuideCopy();
  return (
    <div className="word-details">
      <div className="word-heading">
        <div>
          <div className="word-heading-meta">
            {entry.pos && <span className="word-pos">{entry.pos}</span>}
            {entry.phonetic && <span className="word-phonetic">{entry.phonetic}</span>}
          </div>
          {showWord && <h3>{entry.word}</h3>}
        </div>
        <AudioButton text={entry.word} />
      </div>
      {(entry.verbForms || entry.plural || entry.comparative) && (
        <div className="word-detail-pair">
          {entry.verbForms && (
            <section className="word-detail-block word-verb-forms">
              <div className="word-detail-icon">
                <Icon name="grammar" />
              </div>
              <div>
                <h4>{t("Verb forms")}</h4>
                <p>{entry.verbForms}</p>
              </div>
            </section>
          )}
          {entry.plural && (
            <section className="word-detail-block word-plural">
              <div className="word-detail-icon">
                <Icon name="word-library" />
              </div>
              <div>
                <h4>{t("Plural")}</h4>
                <p>{entry.plural}</p>
              </div>
            </section>
          )}
          {entry.comparative && (
            <section className="word-detail-block word-comparative">
              <div className="word-detail-icon">
                <Icon name="grammar" />
              </div>
              <div>
                <h4>{t("Comparative")}</h4>
                <p>{entry.comparative}</p>
              </div>
            </section>
          )}
        </div>
      )}
      {entry.meaning && (
        <section className="word-detail-block word-meaning">
          <div className="word-detail-icon">
            <Icon name="handbook" />
          </div>
          <div>
            <h4>Meaning</h4>
            <p>{entry.meaning}</p>
          </div>
        </section>
      )}
      <div className="word-detail-pair">
        {entry.zh && (
          <section className="word-detail-block word-translation">
            <div className="word-detail-icon">
              <Icon name="translation" />
            </div>
            <div>
              <h4>中文</h4>
              <p>{entry.zh}</p>
            </div>
          </section>
        )}
        {entry.synonyms && (
          <section className="word-detail-block word-synonyms">
            <div className="word-detail-icon">
              <Icon name="idea" />
            </div>
            <div>
              <h4>Synonyms</h4>
              <p>{entry.synonyms}</p>
            </div>
          </section>
        )}
      </div>
      {entry.collocations && (
        <section className="word-detail-block word-collocations">
          <div className="word-detail-icon">
            <Icon name="grammar" />
          </div>
          <div>
            <h4>Collocations</h4>
            <p>{entry.collocations}</p>
          </div>
        </section>
      )}
      {examples.length > 0 && (
        <section className="word-detail-block word-examples">
          <div className="word-detail-icon">
            <Icon name="ask" />
          </div>
          <div className="word-examples-content">
            <h4>Examples</h4>
            <ol>
              {examples.map((example, index) => (
                <li key={index}>
                  <span className="example-number">{index + 1}</span>
                  <span className="example-copy">
                    <span className="example-text">{example}</span>
                    <span className="example-controls">
                      <AudioButton text={example} small />
                      <CopyButton value={example} label={`Example ${index + 1}`} small />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      {entry.note && (
        <section className="word-detail-block word-note">
          <div className="word-detail-icon">
            <Icon name="idea" />
          </div>
          <div>
            <h4>Note</h4>
            <p>{entry.note}</p>
          </div>
        </section>
      )}
    </div>
  );
}
