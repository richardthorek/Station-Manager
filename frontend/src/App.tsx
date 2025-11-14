import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { SignInPage } from './features/signin/SignInPage';
import { TruckCheckPage } from './features/truckcheck/TruckCheckPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/truckcheck" element={<TruckCheckPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
