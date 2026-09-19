import { useState } from 'react';

import { submitPost, urlFromTemplate } from '../../app/http.js';
import { DIRECTORY_CHANGED } from '../../app/live.js';
import { Avatar } from '../../components/Avatar.jsx';
import { Plus } from '../../components/Icons.jsx';
import { ConfirmModal } from '../../components/Modal.jsx';
import { t } from '../../i18n/index.js';

export const FRIEND_EVENTS = ['friends.changed', DIRECTORY_CHANGED];

const back = () => ({ next: window.location.pathname });

export function PeopleCard({ id, title, count, empty, short = false, children }) {
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id} className="card-header card-title">
        {title}
        {count ? <span className="text-sm font-normal text-muted-foreground">{count}</span> : null}
      </h2>
      {children.length ? (
        <ul className={`people-list ${short ? 'people-list-short' : ''}`}>{children}</ul>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export function PersonRow({ person, detail, online, children }) {
  return (
    <li className="person-row">
      <Avatar name={person.fullName} src={person.avatarUrl} size="md" online={online} />
      <div className="min-w-28 flex-1">
        <a className="person-name" href={person.profileUrl}>
          {person.fullName}
        </a>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
      {children ? <div className="flex shrink-0 flex-wrap justify-end gap-2 ms-auto">{children}</div> : null}
    </li>
  );
}

export function FriendActions({ person, relation, urls, small = false }) {
  const [confirming, setConfirming] = useState(false);
  const size = small ? 'btn-sm' : '';
  const end = () => submitPost(urlFromTemplate(urls.end, relation.friendshipId), back());

  switch (relation.state) {
    case 'none':
      return (
        <button className={`btn btn-primary ${size}`} type="button" onClick={() => submitPost(urls.request, { user_id: person.id, ...back() })}>
          <Plus size={16} />
          {t('friends.add')}
        </button>
      );
    case 'outgoing':
      return (
        <button className={`btn btn-outline ${size}`} type="button" onClick={end}>
          <Minus size={16} />
          {t('friends.cancelRequest')}
        </button>
      );
    case 'incoming':
      return (
        <>
          <button
            className={`btn btn-primary ${size}`}
            type="button"
            onClick={() => submitPost(urlFromTemplate(urls.accept, relation.friendshipId), back())}
          >
            <Plus size={16} />
            {t('friends.accept')}
          </button>
          <button className={`btn btn-outline ${size}`} type="button" onClick={end}>
            <Minus size={16} />
            {t('friends.decline')}
          </button>
        </>
      );
    case 'friends':
      return (
        <>
          <button className={`btn btn-destructive ${size}`} type="button" onClick={() => setConfirming(true)}>
            <Minus size={16} />
            {t('friends.remove')}
          </button>
          {confirming ? (
            <ConfirmModal
              title={t('friends.remove')}
              message={t('friends.removeMessage', { name: person.fullName })}
              footnote={t('friends.removeNote')}
              confirmText={t('friends.yesRemove')}
              destructive
              onCancel={() => setConfirming(false)}
              onConfirm={end}
            />
          ) : null}
        </>
      );
    default:
      return null;
  }
}
