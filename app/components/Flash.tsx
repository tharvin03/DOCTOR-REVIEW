export default function Flash({ msg, err }: { msg?: string; err?: string }) {
  return <>{err && <p className="notice error">{err}</p>}{msg && <p className="notice success">{msg}</p>}</>;
}
