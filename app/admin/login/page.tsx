import { login } from "../actions";

export const metadata = { title: "Admin login", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const sp = await searchParams;
  return (
    <main>
      <div className="wrap" style={{ maxWidth: 380 }}>
        <h1>Admin login</h1>
        {sp.err && <p className="notice error">Incorrect password.</p>}
        {!process.env.ADMIN_PASSWORD && <p className="notice">ADMIN_PASSWORD is not set on the server.</p>}
        <form action={login} className="card stack">
          <div><label htmlFor="pw">Password</label><input id="pw" name="password" type="password" required autoFocus /></div>
          <button className="btn">Sign in</button>
        </form>
      </div>
    </main>
  );
}
