import React, { useState } from "react";
import "./style.css";

export default function App() {
  const [activePage, setActivePage] = useState("Home");

  const pages = {
    Home: {
      eyebrow: "Welcome",
      title: "Your dashboard starts here",
      description:
        "Use the navigation bar to switch between four pages and keep quick actions in the top options area.",
    },
    Services: {
      eyebrow: "Services",
      title: "Explore what your app can offer",
      description:
        "Highlight the main services, features, or categories your users should discover first.",
    },
    About: {
      eyebrow: "About",
      title: "Tell your story clearly",
      description:
        "Share your mission, team, and values with a page that feels separate but stays inside the same app shell.",
    },
    Contact: {
      eyebrow: "Contact",
      title: "Keep communication simple",
      description:
        "Give visitors a clear place to reach out, ask questions, or request support.",
    },
  };

  const pageNames = Object.keys(pages);
  const currentPage = pages[activePage];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-tag">Multi Page UI</p>
          <h1 className="brand-title">Navbar App</h1>
        </div>

        <div className="top-options">
          <button type="button">Search</button>
          <button type="button">Profile</button>
          <button type="button">Settings</button>
        </div>
      </header>

      <nav className="navbar" aria-label="Main navigation">
        {pageNames.map((page) => (
          <button
            key={page}
            type="button"
            className={activePage === page ? "nav-link active" : "nav-link"}
            onClick={() => setActivePage(page)}
          >
            {page}
          </button>
        ))}
      </nav>

      <main className="page-card">
        <p className="page-eyebrow">{currentPage.eyebrow}</p>
        <h2>{currentPage.title}</h2>
        <p className="page-description">{currentPage.description}</p>

        <div className="info-grid">
          <section>
            <h3>Current page</h3>
            <p>{activePage}</p>
          </section>
          <section>
            <h3>Extra options</h3>
            <p>The top-right buttons are reserved for more actions.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
