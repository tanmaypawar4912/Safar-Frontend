import { Link } from "react-router";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Building2, Container, Headphones,
  Package, Radar, ShieldCheck, Tag, Truck,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "../../components/layout/PublicChrome";
import "./Home.css";

const services = [
  { title: "Local delivery", text: "Send parcels and goods across your city.", icon: Package, to: "/customer/book" },
  { title: "Intercity transport", text: "Move goods between cities with a verified driver.", icon: Truck, to: "/customer/book" },
  { title: "Business logistics", text: "Plan recurring shipments for your business.", icon: Building2, to: "/customer/book" },
  { title: "Heavy & bulk cargo", text: "Find a vehicle with the capacity your shipment needs.", icon: Container, to: "/customer/book" },
];

const features = [
  { title: "Real-time tracking", text: "Follow your shipment from pickup to drop-off.", icon: Radar },
  { title: "Verified drivers", text: "Ship with drivers who have completed verification.", icon: ShieldCheck },
  { title: "Upfront estimates", text: "See your estimated fare before booking.", icon: Tag },
  { title: "24/7 support", text: "Get help whenever you need it.", icon: Headphones },
];

export default function Home() {
  return (
    <div className="lgh" id="top">
      <a className="lgh-skip" href="#main-content">Skip to main content</a>
      <PublicHeader />

      <main className="lgh-wrap" id="main-content" tabIndex={-1}>
        <section className="lgh-hero" aria-labelledby="lgh-title">
          <div className="lgh-hero-copy">
            <p className="lgh-eyebrow"><Truck size={16} /> On-demand logistics</p>
            <h1 id="lgh-title">Move anything.<br /><em>Go anywhere.</em></h1>
            <p className="lgh-intro">From a parcel across town to a truckload across cities. Book a vehicle, get an upfront estimate and track your delivery live.</p>
            <div className="lgh-hero-actions">
              <Link className="lgh-button lgh-button-orange" to="/customer/book">Book a delivery <ArrowUpRight size={18} /></Link>
              <a className="lgh-text-link" href="#services">Explore services <ArrowDown size={16} /></a>
            </div>
          </div>
          <figure className="lgh-photo">
            <img
              className="lgh-hero-image"
              src="/images/logigo-goa-road.jpg"
              alt="A palm-lined Goan road passing red-tiled houses"
              width={1672}
              height={941}
              fetchPriority="high"
            />
          </figure>
        </section>

        <section className="lgh-section" id="services" aria-labelledby="lgh-services-title">
          <div className="lgh-section-heading">
            <div>
              <p className="lgh-eyebrow">Our services</p>
              <h2 id="lgh-services-title">What are you moving?</h2>
            </div>
            <Link className="lgh-text-link" to="/customer/book">Book a delivery <ArrowRight size={17} /></Link>
          </div>
          <div className="lgh-service-grid">
            {services.map(({ title, text, icon: Icon, to }) => (
              <Link className="lgh-service" key={title} to={to}>
                <div className="lgh-card-top">
                  <span className="lgh-service-icon"><Icon size={24} strokeWidth={1.8} /></span>
                  <ArrowUpRight className="lgh-card-arrow" size={20} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="lgh-features" id="features" aria-labelledby="lgh-features-title">
          <div className="lgh-features-copy">
            <p className="lgh-eyebrow">The Safar experience</p>
            <h2 id="lgh-features-title">Know where your goods are going.</h2>
            <Link className="lgh-button lgh-button-orange" to="/customer/book">Plan your delivery <ArrowUpRight size={18} /></Link>
          </div>
          <ul className="lgh-feature-grid">
            {features.map(({ title, text, icon: Icon }) => (
              <li key={title}>
                <Icon size={23} strokeWidth={1.8} />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="lgh-section safar-steps" id="how-it-works" aria-labelledby="safar-steps-title">
          <h2 id="safar-steps-title">How Safar works</h2>
          <ol>
            <li><h3>Enter your route</h3><p>Add pickup and drop-off addresses and describe your load.</p></li>
            <li><h3>Review your estimate</h3><p>Choose a vehicle that fits your goods and review the estimated fare.</p></li>
            <li><h3>Confirm and track</h3><p>Sign in to confirm. An eligible driver must accept before assignment.</p></li>
          </ol>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
