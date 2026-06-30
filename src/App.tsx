import "./App.css";
import Navbar from "./components/layout/Navbar";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <div className="app">
      <Navbar basketItemCount={0} />
      <HomePage />
    </div>
  );
}

export default App;