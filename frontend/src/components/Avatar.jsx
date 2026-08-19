
const SIZES = { sm: 'size-8', header: 'size-8.5', md: 'size-10', lg: 'size-24 text-2xl' };

function initialsFromName(name) {
  const [first, second] = name.trim().split(/\s+/);
  return (second ? first[0] + second[0] : first.slice(0, 2)).toUpperCase();
}

export function Avatar({ name, src, size = 'sm', online, primary = false }) {
  return (
    <span className={`avatar relative ${primary && !src ? 'avatar-primary' : ''} ${SIZES[size]}`}>
      {src ? <img className="avatar-image" src={src} alt="" /> : <span aria-hidden="true">{initialsFromName(name)}</span>}
      {online === undefined ? null : (
        <span className={`avatar-status ${online ? 'avatar-status-online' : ''}`}>
          <span className="sr-only">{online ? "Online" : "Offline"}</span>
        </span>
      )}
    </span>
  );
}

