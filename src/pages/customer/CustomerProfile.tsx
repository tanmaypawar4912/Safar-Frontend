import { Link } from "react-router";
import { ArrowRight, ClipboardList } from "lucide-react";

import AccountSecurityPanel from "../../components/account/AccountSecurityPanel";
import ProfileCard from "../../components/account/ProfileCard";

function CustomerProfile() {
  return (
    <main className="lgp">
      <header className="lgp-head">
        <div>
          <h1>My Profile</h1>
          <p>Manage your personal information</p>
        </div>
      </header>

      <div className="lgpf-layout">
        <ProfileCard accountLabel="Customer account" />
        <AccountSecurityPanel />
      </div>

      <div className="lgpf-links">
        <Link to="/customer/orders" className="lgp-btn lgp-btn-ghost"><ClipboardList aria-hidden="true" /> View my orders</Link>
        <Link to="/customer/book" className="lgp-btn lgp-btn-primary">Book a delivery <ArrowRight aria-hidden="true" /></Link>
      </div>
    </main>
  );
}

export default CustomerProfile;
