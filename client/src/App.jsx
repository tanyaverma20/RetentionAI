import { Route, Routes } from 'react-router-dom';
import BaseLayout from './layouts/BaseLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<BaseLayout />}>
        <Route index element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
