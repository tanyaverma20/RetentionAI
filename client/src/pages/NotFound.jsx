import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section>
      <p className="text-sm font-medium text-cyan-600">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <Link className="mt-6 inline-block text-cyan-600 underline" to="/">
        Return home
      </Link>
    </section>
  );
}
