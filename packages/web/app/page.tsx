import Link from "next/link";
import { GiftLetter } from "@/components/hero/GiftLetter";
import { SiteNav } from "@/components/nav/SiteNav";
import "./home.css";

const steps = [
  {
    number: "01",
    icon: "◈",
    title: "Choose a token.",
    body: "Connect a NEAR Testnet wallet and choose an allowlisted NEP-141 token and amount.",
  },
  {
    number: "02",
    icon: "♡",
    title: "Make it personal.",
    body: "Add a note. Santa encrypts it in your browser before it is stored with the gift.",
  },
  {
    number: "03",
    icon: "↗",
    title: "Share a private link.",
    body: "Your recipient connects a NEAR wallet. Santa sponsors the claim; unclaimed gifts can be refunded after expiry.",
  },
];

export default function Home() {
  return (
    <div className="home">
      <SiteNav />
      <main id="main-content">
        <section className="landing-hero" aria-labelledby="home-title">
          <div className="landing-copy">
            <p className="eyebrow"><span className="status-dot" /> SMALL GESTURES. NEW POSSIBILITIES.</p>
            <h1 id="home-title">Give a token.<br />Share a<br /><em>little love.</em></h1>
            <p className="landing-description">
              Send an allowlisted NEAR Testnet token to someone you love. Add a private note,
              wrap it in a claim link, and let Santa take care of the recipient’s gas.
            </p>
            <div className="landing-actions">
              <Link className="button-primary" href="/send" prefetch={false}>
                Send a gift <span aria-hidden="true">↗</span>
              </Link>
              <a className="button-text" href="#how">See how it works <span aria-hidden="true">↓</span></a>
            </div>
            <p className="landing-footnote"><span aria-hidden="true">✧</span> A new way to say, “I thought of you.”</p>
          </div>
          <GiftLetter />
        </section>

        <div className="network-strip">
          <span className="network-strip-title"><span className="status-dot" /> TESTNET TOKENS. PERSONAL GIFTS.</span>
          <p>Built on NEAR Testnet<span aria-hidden="true"> · </span><strong>NEP-141 gifts with sponsored claims.</strong></p>
        </div>

        <section className="how-section" id="how" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">THOUGHTFUL BY DESIGN</p>
            <h2 id="how-title">Big on thought.<br /><em>Light on effort.</em></h2>
            <p>From “this made me think of you”<br />to “you’ve got a gift.” In three simple steps.</p>
          </div>
          <ol className="how-steps">
            {steps.map((step) => (
              <li key={step.number}>
                <div className="how-step-top"><span>{step.number}</span><span className="how-step-icon" aria-hidden="true">{step.icon}</span></div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="thoughtful-section" aria-labelledby="thoughtful-title">
          <div className="little-note">
            <span aria-hidden="true">♡</span>
            <p>For the curious ones.<br />The “just because” ones.<br /><em>Your kind of people.</em></p>
            <span className="note-signature">with love, santa</span>
          </div>
          <div>
            <p className="eyebrow">A GIFT, WITHOUT THE GUESSWORK</p>
            <h2 id="thoughtful-title">You bring the thought.<br /><em>We’ll bring the wrap.</em></h2>
            <ul className="gift-benefits">
              <li>
                <span aria-hidden="true">✓</span>
                <div><h3>One link, one NEAR wallet.</h3><p>Your recipient connects a NEAR Testnet account to claim their gift.</p></div>
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                <div><h3>A note wrapped with care.</h3><p>Your note is encrypted in the browser and stays private until the gift is claimed.</p></div>
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                <div><h3>A little peace of mind.</h3><p>If the gift expires unopened, the sender can request a token refund.</p></div>
              </li>
            </ul>
            <Link className="button-text" href="/docs/how-it-works" prefetch={false}>
              Get to know Santa <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>

        <section className="how-section" id="judges" aria-labelledby="judges-title">
          <div className="section-heading">
            <p className="eyebrow">FOR JUDGES</p>
            <h2 id="judges-title">Try a complete gift.</h2>
            <p>Use a NEAR Testnet wallet and an allowlisted NEP-141 test token. No mainnet assets are involved.</p>
          </div>
          <ol className="how-steps">
            <li><div className="how-step-top"><span>01</span></div><h3>Connect</h3><p>Open the send page and connect a NEAR Testnet wallet with an allowlisted token balance.</p></li>
            <li><div className="how-step-top"><span>02</span></div><h3>Send</h3><p>Choose an amount and expiry, add an optional note, approve the FT transfer, then share the generated link.</p></li>
            <li><div className="how-step-top"><span>03</span></div><h3>Claim</h3><p>Open the complete link in another browser, connect the recipient wallet, and claim with sponsored testnet gas.</p></li>
          </ol>
        </section>

        <section className="closing-section">
          <span aria-hidden="true">✳</span>
          <p className="eyebrow">A LITTLE LINK CAN GO A LONG WAY</p>
          <h2>Someone came to mind?<br /><em>Make their day.</em></h2>
          <Link className="button-primary" href="/send" prefetch={false}>
            Send a gift <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-top">
          <Link className="footer-brand" href="/">santa<span aria-hidden="true">♡</span></Link>
          <p>A little thought, beautifully delivered.</p>
          <nav aria-label="Footer">
            <Link href="/docs" prefetch={false}>Documentation ↗</Link>
            <a href="#judges">For judges ↗</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>Made for the joy of giving.</p>
          <p>Santa is an independent NEAR Testnet project.<br />Testnet tokens have no monetary value.</p>
          <span>NEAR TESTNET</span>
        </div>
      </footer>
    </div>
  );
}
